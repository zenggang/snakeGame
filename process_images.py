from PIL import Image
import os

def remove_bg(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    try:
        img = Image.open(filepath).convert("RGBA")
        datas = img.getdata()
        
        # Assume top-left pixel is background color
        bg = datas[0]
        tolerance = 40
        
        newData = []
        for item in datas:
            if abs(item[0] - bg[0]) <= tolerance and \
               abs(item[1] - bg[1]) <= tolerance and \
               abs(item[2] - bg[2]) <= tolerance:
                # replacing it with a transparent pixel
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
                
        img.putdata(newData)
        img.save(filepath, "PNG")
        print(f"Successfully processed {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

# Process the two spritesheets
assets_dir = "/Users/javababy/Downloads/AI demo/snakeGame/assets"
remove_bg(os.path.join(assets_dir, "character.png"))
remove_bg(os.path.join(assets_dir, "props.png"))
