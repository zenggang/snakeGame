from PIL import Image
import os
import shutil

src_dir = "/Users/javababy/.gemini/antigravity/brain/ca56149f-93c2-4c8e-a5f9-ea3d372abfc5"
dest_dir = "/Users/javababy/Downloads/AI demo/snakeGame/assets"

files_to_process = {
    "dog_head_1771735158991.png": "dog_head.png",
    "dog_body_1771735173481.png": "dog_body.png",
    "dog_tail_1771735185002.png": "dog_tail.png"
}

background = {
    "grass_bg_1771735197082.png": "scene.png"
}

# Copy and rename new seamless background
src_bg = os.path.join(src_dir, list(background.keys())[0])
dest_bg = os.path.join(dest_dir, list(background.values())[0])
shutil.copy(src_bg, dest_bg)

def remove_bg(src, dest):
    if not os.path.exists(src):
        print(f"File not found: {src}")
        return
    img = Image.open(src).convert("RGBA")
    datas = img.getdata()
    # Replace white (#ffffff) or very close to white background with transparent
    newData = []
    for item in datas:
        # Check against pure white background
        if item[0] >= 240 and item[1] >= 240 and item[2] >= 240:
            newData.append((255, 255, 255, 0)) # transparent
        else:
            newData.append(item)
    img.putdata(newData)
    img.save(dest, "PNG")
    print(f"Processed transparent art: {dest}")

for k, v in files_to_process.items():
    src = os.path.join(src_dir, k)
    dest = os.path.join(dest_dir, v)
    remove_bg(src, dest)
