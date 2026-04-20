"""
BRDF Estimator
==============

Core module for BRDF parameter estimation using differentiable rendering.
Implements a Cook-Torrance BRDF optimization pipeline.

Author: Benaya Josua
Date: 19 February 2026
"""

from typing import Any, Callable, Dict, Optional, Tuple
import logging

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)


class CookTorranceBRDF(nn.Module):
    """Cook-Torrance BRDF model.

    Implements:
    f_r = k_d * (c / pi) + k_s * (D * F * G) / (4 * (n·l) * (n·v))

    Estimated parameters:
    - albedo (base color): RGB in [0, 1]
    - roughness: scalar in [0, 1]
    - metallic: scalar in [0, 1]
    """

    def __init__(self) -> None:
        super().__init__()
        self.pi = np.pi

    def ggx_distribution(self, nh: torch.Tensor, roughness: torch.Tensor) -> torch.Tensor:
        """GGX (Trowbridge-Reitz) normal distribution function."""
        a = roughness * roughness
        a2 = a * a
        nh2 = nh * nh
        denom = nh2 * (a2 - 1.0) + 1.0
        return a2 / (self.pi * torch.clamp(denom * denom, min=1e-6))

    def schlick_fresnel(self, hv: torch.Tensor, f0: torch.Tensor) -> torch.Tensor:
        """Schlick Fresnel approximation."""
        one_minus_hv = torch.clamp(1.0 - hv, min=0.0, max=1.0)
        return f0 + (1.0 - f0) * torch.pow(one_minus_hv, 5.0)

    def schlick_ggx(self, nl: torch.Tensor, nv: torch.Tensor, roughness: torch.Tensor) -> torch.Tensor:
        """Schlick-GGX geometry attenuation function."""
        r = (roughness + 1.0) * (roughness + 1.0) / 8.0
        ggx_l = nl / torch.clamp(nl * (1.0 - r) + r, min=1e-6)
        ggx_v = nv / torch.clamp(nv * (1.0 - r) + r, min=1e-6)
        return ggx_l * ggx_v

    def forward(
        self,
        normal: torch.Tensor,
        view_dir: torch.Tensor,
        light_dir: torch.Tensor,
        albedo: torch.Tensor,
        roughness: torch.Tensor,
        metallic: torch.Tensor,
    ) -> torch.Tensor:
        """Compute BRDF shading for viewing/lighting directions.

        Args:
            normal: surface normals [B, H, W, 3]
            view_dir: normalized view direction [B, H, W, 3]
            light_dir: normalized light direction [B, H, W, 3]
            albedo: base color [3] or [B, 3]
            roughness: [1], scalar, or [B, 1]
            metallic: [1], scalar, or [B, 1]

        Returns:
            RGB color [B, H, W, 3], clamped to [0, 1]
        """
        batch_size = normal.shape[0]

        if albedo.dim() == 1:
            albedo = albedo.unsqueeze(0)

        if roughness.dim() == 0:
            roughness = roughness.view(1, 1)
        elif roughness.dim() == 1:
            roughness = roughness.view(-1, 1)

        if metallic.dim() == 0:
            metallic = metallic.view(1, 1)
        elif metallic.dim() == 1:
            metallic = metallic.view(-1, 1)

        if albedo.shape[0] == 1 and batch_size > 1:
            albedo = albedo.expand(batch_size, -1)
        if roughness.shape[0] == 1 and batch_size > 1:
            roughness = roughness.expand(batch_size, -1)
        if metallic.shape[0] == 1 and batch_size > 1:
            metallic = metallic.expand(batch_size, -1)

        albedo_map = albedo.view(batch_size, 1, 1, 3)
        roughness_map = roughness.view(batch_size, 1, 1, 1)
        metallic_map = metallic.view(batch_size, 1, 1, 1)

        half = F.normalize(view_dir + light_dir, dim=-1)

        nh = torch.clamp(torch.sum(normal * half, dim=-1, keepdim=True), 0.0, 1.0)
        nl = torch.clamp(torch.sum(normal * light_dir, dim=-1, keepdim=True), 0.0, 1.0)
        nv = torch.clamp(torch.sum(normal * view_dir, dim=-1, keepdim=True), 0.0, 1.0)
        hv = torch.clamp(torch.sum(half * view_dir, dim=-1, keepdim=True), 0.0, 1.0)

        # Fresnel base reflectance, mixed by metallic factor.
        f0_dielectric = torch.full((batch_size, 3), 0.04, device=albedo.device, dtype=albedo.dtype)
        f0 = torch.lerp(f0_dielectric, albedo, metallic.expand(-1, 3)).view(batch_size, 1, 1, 3)
        f = self.schlick_fresnel(hv, f0)

        d = self.ggx_distribution(nh, roughness_map)
        g = self.schlick_ggx(nl, nv, roughness_map)

        numerator = d * f * g
        denominator = torch.clamp(4.0 * nl * nv, min=1e-6)
        specular = numerator / denominator

        kd = (1.0 - f) * (1.0 - metallic_map)
        diffuse = albedo_map / self.pi

        color = (kd * diffuse + specular) * nl
        return torch.clamp(color, 0.0, 1.0)


class BRDFEstimator:
    """High-level BRDF estimation engine."""

    def __init__(
        self,
        device: Optional[torch.device] = None,
        lr: float = 0.01,
        max_iterations: int = 1000,
    ) -> None:
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.lr = lr
        self.max_iterations = max_iterations

        self.brdf = CookTorranceBRDF().to(self.device)
        self.loss_history = []

        logger.info("BRDF Estimator initialized on %s", self.device)

    def initialize_parameters(
        self,
        init_albedo: Optional[np.ndarray] = None,
        init_roughness: float = 0.5,
        init_metallic: float = 0.0,
    ) -> Dict[str, torch.Tensor]:
        """Initialize trainable BRDF parameters."""
        if init_albedo is None:
            init_albedo = np.array([0.5, 0.5, 0.5], dtype=np.float32)

        params = {
            "albedo": torch.tensor(
                init_albedo,
                dtype=torch.float32,
                device=self.device,
                requires_grad=True,
            ),
            "roughness": torch.tensor(
                [init_roughness],
                dtype=torch.float32,
                device=self.device,
                requires_grad=True,
            ),
            "metallic": torch.tensor(
                [init_metallic],
                dtype=torch.float32,
                device=self.device,
                requires_grad=True,
            ),
        }

        logger.info(
            "Parameters initialized: albedo=%s, roughness=%s, metallic=%s",
            init_albedo,
            init_roughness,
            init_metallic,
        )
        return params

    def compute_loss(
        self,
        rendered: torch.Tensor,
        target: torch.Tensor,
        weights: Optional[Dict[str, float]] = None,
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        """Compute optimization loss terms.

        Currently uses photometric MSE as the total loss.
        """
        _ = weights  # Reserved for future multi-term loss support.

        loss_photo = F.mse_loss(rendered, target)
        losses = {
            "photometric": loss_photo.item(),
            "total": loss_photo.item(),
        }
        return loss_photo, losses

    @staticmethod
    def clamp_parameters(params: Dict[str, torch.Tensor]) -> None:
        """Clamp BRDF parameters to physically valid ranges."""
        with torch.no_grad():
            params["albedo"].clamp_(0.0, 1.0)
            params["roughness"].clamp_(0.0, 1.0)
            params["metallic"].clamp_(0.0, 1.0)

    def optimize(
        self,
        render_fn: Callable[..., torch.Tensor],
        target_image: torch.Tensor,
        init_params: Optional[Dict[str, torch.Tensor]] = None,
        num_iterations: Optional[int] = None,
        callback: Optional[Callable[[int, float, Dict[str, torch.Tensor]], None]] = None,
    ) -> Dict[str, Any]:
        """Run BRDF parameter optimization."""
        if init_params is None:
            init_params = self.initialize_parameters()

        num_iterations = num_iterations or self.max_iterations

        optimizer = torch.optim.Adam(list(init_params.values()), lr=self.lr)
        scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=100, gamma=0.8)

        self.loss_history = []
        param_history = {key: [] for key in init_params.keys()}

        logger.info("Starting optimization for %d iterations", num_iterations)

        for iteration in range(num_iterations):
            optimizer.zero_grad()

            rendered = render_fn(**init_params)
            loss, losses_dict = self.compute_loss(rendered, target_image)

            loss.backward()
            optimizer.step()
            scheduler.step()

            self.clamp_parameters(init_params)

            self.loss_history.append(loss.item())
            for key, value in init_params.items():
                param_history[key].append(value.detach().cpu().numpy().copy())

            if callback is not None and (iteration + 1) % 50 == 0:
                callback(iteration, loss.item(), init_params)

            if (iteration + 1) % 100 == 0:
                logger.debug("Iter %d | loss=%.6f", iteration + 1, losses_dict["total"])

        logger.info("Optimization complete. Final loss: %.6f", self.loss_history[-1])

        return {
            "parameters": init_params,
            "loss_history": self.loss_history,
            "param_history": param_history,
            "final_loss": self.loss_history[-1],
        }


if __name__ == "__main__":
    _ = CookTorranceBRDF()
    _ = BRDFEstimator()
    print("BRDF modules loaded successfully")
