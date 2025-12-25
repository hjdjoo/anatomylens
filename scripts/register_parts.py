import json
import os
from pprint import pprint


def scan_hierarchy():

  registry = {}

  hierarchies_path = os.path.expanduser("~/Code/anatomy-explorer/src/data/hierarchies.json")

  with open(hierarchies_path, "r") as hierarchy:
    hierarchy_data = json.load(hierarchy)

    for key in hierarchy_data:
      """
      keys: fasciae.g, muscles.g, joints.g, skeletal system.g
      """
      traverse(hierarchy_data[key], registry)

  return registry
  
"""
hierarchy - raw hierarchy data from hierarchy.json
hierarchy_data - dictionary to store the hierarchy data
"""
def traverse(hierarchy, registry):

  target = "upper limb"

  registry[target] = []

  for key in hierarchy:
    if target in key.lower():
      register(hierarchy[key], registry)


"""
hierarchy - raw hierarchy data from hierarchy.json
hierarchy_data - dictionary to store the hierarchy data
"""
def register(hierarchy, registry):

  exclude_suffix = [".g", ".s", ".i", ".j", ".t"]

  register_patterns = {
    "shoulder": ["clavi", "scap", "acromi"],
    "arm": ["brachi", "humer"],
    "elbow": ["elbow", "troch", "olecr",],
    "forearm": ["radius", "ulna",],
    "hand": ["hand", "finger", "carp", "metacarp", "phalan", "capit"],
  }


  for key in hierarchy:
    if any(key.endswith(suffix) for suffix in exclude_suffix):
      register(hierarchy[key], registry)
    else:
      registry[key] = key

  
if __name__ == "__main__":
  registry = scan_hierarchy()
  pprint(registry)
  