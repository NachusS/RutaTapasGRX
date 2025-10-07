import os, json, sys

try:
    import requests
except ImportError:
    print("Instala requests: pip install requests")
    sys.exit(1)

BASE = os.path.dirname(os.path.dirname(__file__))
assets = os.path.join(BASE, "assets")
data = os.path.join(BASE, "data")

with open(os.path.join(data, "remote_photos.json"), "r", encoding="utf-8") as f:
    mapping = json.load(f)

os.makedirs(assets, exist_ok=True)

def download(url, out_path):
    try:
        r = requests.get(url, timeout=30, stream=True)
        r.raise_for_status()
        with open(out_path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        print("OK:", out_path)
    except Exception as e:
        print("FAIL:", url, "->", e)

for stop_id, url in mapping.items():
    if not url:
        continue
    ext = ".jpg"
    if ".png" in url.split("?")[0].lower(): ext = ".png"
    out = os.path.join(assets, f"{stop_id}{ext}")
    download(url, out)
