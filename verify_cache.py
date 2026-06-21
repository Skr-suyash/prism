import time
t = time.time()

from backend.services.priority_service import PriorityService
from backend.services.misclassification_service import MisclassificationService
from backend.services.network_service import NetworkService

s = PriorityService()
s.initialize()

m = MisclassificationService()
m.initialize()

n = NetworkService()
n.initialize()

elapsed = time.time() - t
print(f"\nTotal startup: {elapsed:.2f}s")
print(f"Zones: {len(s.get_zones())}")
print(f"Heatmap points: {len(s.get_heatmap())}")
print(f"Confusion matrix: {len(m.get_confusion_matrix())}")
print(f"Cluster scatter points: {len(n.get_clusters()['scatter_data'])}")
print(f"Hubs: {len(n.get_hubs())}")
print(f"Offender archetypes: {len(n.get_offenders())}")
