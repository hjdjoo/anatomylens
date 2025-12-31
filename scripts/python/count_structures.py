import json

def count_structures():
  with open('src/data/body_registry.json', 'r') as f:
    registry = json.load(f)
  
  total = 0

  for region in registry:
    if registry[region].get("count"):
      total += registry[region]["count"]

      print(f"{region}: {registry[region]['count']} structures")

  print(f"Total structures counted: {total}")
  return total

if __name__ == "__main__":
  count_structures()

