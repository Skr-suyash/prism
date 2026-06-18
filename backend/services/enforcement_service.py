"""
Enforcement Service — Shift Recommender (Greedy Allocation).

Loads the precomputed zone×shift priority matrix and runs a greedy
algorithm to allocate N officers to maximize citywide priority coverage.
"""

import json
import os
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE_DIR = Path(BASE_DIR) / "backend" / "cache"


class EnforcementService:
    def __init__(self):
        self.matrix = []
        self.total_citywide_priority = 0.0
        self.shift_labels = []
        self.total_zones = 0

    def initialize(self):
        """Load from cache."""
        if self._load_from_cache():
            print("[EnforcementService] Ready (loaded from cache).")
            return
        print("[EnforcementService] No cache found! Run precompute.py first.")

    def _load_from_cache(self) -> bool:
        path = CACHE_DIR / "enforcement_matrix.json"
        if not path.exists():
            return False

        print("[EnforcementService] Loading from cache...")
        with open(path) as f:
            data = json.load(f)
        self.matrix = data["matrix"]
        self.total_citywide_priority = data["total_citywide_priority"]
        self.shift_labels = data["shift_labels"]
        self.total_zones = data["total_zones"]
        return True

    def get_matrix(self):
        """Return the full zone×shift priority matrix."""
        return {
            "matrix": self.matrix,
            "total_citywide_priority": self.total_citywide_priority,
            "shift_labels": self.shift_labels,
            "total_zones": self.total_zones,
        }

    def allocate(self, n_officers: int, max_per_cell: int = 3):
        """
        Greedy allocation: assign officers to (zone, shift) cells
        ranked by total_priority, capped at max_per_cell per cell.
        
        Returns the allocation plan + coverage metrics.
        """
        if not self.matrix:
            return {"error": "No matrix data available"}

        # Sort cells by total_priority descending
        cells = sorted(self.matrix, key=lambda c: c["total_priority"], reverse=True)

        # Track allocations
        allocations = []
        cell_officers = {}

        # Allocate independently per shift
        for shift_slot in range(3):
            shift_cells = [c for c in cells if c["shift_slot"] == shift_slot]
            remaining = n_officers
            
            for cell in shift_cells:
                if remaining <= 0:
                    break

                key = (cell["police_station"], cell["shift_slot"])
                current = cell_officers.get(key, 0)

                if current >= max_per_cell:
                    continue

                assign = min(max_per_cell - current, remaining)
                cell_officers[key] = current + assign
                remaining -= assign

                allocations.append({
                    "zone": cell["police_station"],
                    "shift_slot": cell["shift_slot"],
                    "slot_label": cell["slot_label"],
                    "officers": assign,
                    "total_priority": cell["total_priority"],
                    "violation_count": cell["violation_count"],
                    "mean_priority": cell["mean_priority"],
                    "lat": cell["lat"],
                    "lng": cell["lng"],
                })

        # Coverage calculation
        covered_priority = sum(a["total_priority"] for a in allocations)
        coverage_pct = round(covered_priority / self.total_citywide_priority * 100, 1) if self.total_citywide_priority > 0 else 0

        # Uniform deployment comparison
        # Spreading N officers evenly across all Z zones per shift
        if self.total_zones > 0 and n_officers > 0:
            uniform_priority = 0
            for shift_slot in range(3):
                shift_cells = [c for c in cells if c["shift_slot"] == shift_slot]
                shift_total_priority = sum(c["total_priority"] for c in shift_cells)
                
                # If N officers are distributed equally across Z zones, each zone gets N/Z officers.
                # Assuming it takes `max_per_cell` officers to fully cover a zone's priority,
                # the fraction of priority covered in EVERY zone is (N/Z) / max_per_cell
                fraction_covered = min(1.0, (n_officers / self.total_zones) / max_per_cell)
                uniform_priority += shift_total_priority * fraction_covered
            
            uniform_coverage = round(uniform_priority / self.total_citywide_priority * 100, 1) if self.total_citywide_priority > 0 else 0
        else:
            uniform_coverage = 0

        # Per-shift summary
        shift_summary = {}
        for a in allocations:
            label = a["slot_label"]
            if label not in shift_summary:
                shift_summary[label] = {"officers": 0, "priority_covered": 0, "zones": []}
            shift_summary[label]["officers"] += a["officers"]
            shift_summary[label]["priority_covered"] = round(
                shift_summary[label]["priority_covered"] + a["total_priority"], 2
            )
            shift_summary[label]["zones"].append(a["zone"])

        return {
            "n_officers": n_officers,
            "max_per_cell": max_per_cell,
            "allocations": allocations,
            "coverage_pct": coverage_pct,
            "uniform_coverage_pct": uniform_coverage,
            "covered_priority": round(covered_priority, 2),
            "total_citywide_priority": round(self.total_citywide_priority, 2),
            "shift_summary": shift_summary,
            "zones_covered": len(set(a["zone"] for a in allocations)),
            "total_zones": self.total_zones,
        }
