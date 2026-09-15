import os
import glob
from pptx import Presentation
from pptx.util import Inches, Pt
from docx import Document
from docx.shared import Inches as DocxInches

# Data for the presentation and report
items = [
    {
        "component": "Drag Chains",
        "product": "LAPP SILVYN® CHAIN",
        "description": "LAPP's SILVYN® CHAIN systems are designed for cable protection and management in dynamic applications."
    },
    {
        "component": "Continuous Movement Cables",
        "product": "LAPP ÖLFLEX® SERVO FD",
        "description": "ÖLFLEX® FD cables are highly flexible cables specifically engineered for continuous movement within drag chains. Suitable for applications due to their high flexibility and durability in constantly moving parts."
    },
    {
        "component": "Control Cabinet and Cable Glands",
        "product": "LAPP SKINTOP® Cable Gland",
        "description": "SKINTOP® cable glands provide secure, strain-relieved, and often liquid-tight cable entry into control cabinets."
    },
    {
        "component": "Control Cabinet Wiring",
        "product": "LAPP ÖLFLEX® UNIPLUS",
        "description": "ÖLFLEX® UNIPLUS single-core cables are ideal for internal wiring of devices and control cabinets."
    },
    {
        "component": "Cable Bundling",
        "product": "LAPP KW Plastic Coil",
        "description": "KW plastic coils are used for easy and quick bundling of cables, providing mechanical protection and organization."
    },
    {
        "component": "Circular Connectors",
        "product": "LAPP EPIC® M12",
        "description": "EPIC® circular connectors, such as M12 connectors, are suitable for robust data, signal, and power connections in industrial applications, offering vibration protection and easy assembly."
    },
    {
        "component": "Laptop Connection and Data Cables",
        "product": "UNITRONIC® & ETHERLINE®",
        "description": "UNITRONIC® (Data & Communication Cables) and ETHERLINE® (Industrial Ethernet Cables) are used for reliable data transmission and network connectivity."
    }
]

def get_recent_images():
    # Folder paths to search
    folders = [
        r"C:\Users\DELL\.gemini\antigravity\brain\8c545920-27be-41b4-b8c3-1290228e41ed",
        r"C:\Users\DELL\.gemini\antigravity\brain\tempmediaStorage"
    ]
    images = []
    for folder in folders:
        for ext in ["*.jpg", "*.jpeg", "*.png"]:
            images.extend(glob.glob(os.path.join(folder, ext)))
    
    # Sort by creation time, newest first
    images.sort(key=os.path.getmtime, reverse=True)
    # Only keep images created today (take top 12 as they were all uploaded just now)
    return images[:12]

def create_ppt(images):
    prs = Presentation()
    
    # Title Slide
    title_slide_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(title_slide_layout)
    title = slide.shapes.title
    subtitle = slide.placeholders[1]
    title.text = "LAPP Products Used in Equipment"
    subtitle.text = "Component Integration Overview (With Images)"
    
    # Content Slides
    bullet_slide_layout = prs.slide_layouts[1]
    for item in items:
        slide = prs.slides.add_slide(bullet_slide_layout)
        shapes = slide.shapes
        title_shape = shapes.title
        body_shape = shapes.placeholders[1]
        
        title_shape.text = item["component"]
        tf = body_shape.text_frame
        
        p1 = tf.paragraphs[0]
        p1.text = f"Matching LAPP Product: {item['product']}"
        p1.font.bold = True
        
        p2 = tf.add_paragraph()
        p2.text = item["description"]
        p2.level = 1
        
    # Image Slides
    image_slide_layout = prs.slide_layouts[5] # blank slide with title
    for img_path in images:
        try:
            slide = prs.slides.add_slide(image_slide_layout)
            title = slide.shapes.title
            title.text = "Equipment & Product Images"
            slide.shapes.add_picture(img_path, Inches(1), Inches(1.5), width=Inches(8))
        except Exception as e:
            print(f"Failed to add image to PPT: {img_path} - {e}")
            
    prs.save('LAPP_Equipment_Presentation_v2.pptx')

def create_word(images):
    doc = Document()
    doc.add_heading('LAPP Products Used in Equipment', 0)
    
    for i, item in enumerate(items, 1):
        doc.add_heading(f"{i}. {item['component']}", level=1)
        
        p = doc.add_paragraph()
        p.add_run("Matching LAPP Products: ").bold = True
        p.add_run(item['product'])
        
        doc.add_paragraph(item['description'])
        doc.add_paragraph()
        
    doc.add_heading("Equipment & Product Images", level=1)
    for img_path in images:
        try:
            doc.add_picture(img_path, width=DocxInches(6))
            doc.add_paragraph() # Add space
        except Exception as e:
            print(f"Failed to add image to Word: {img_path} - {e}")
            
    doc.save('LAPP_Equipment_Report_v2.docx')

if __name__ == "__main__":
    imgs = get_recent_images()
    create_ppt(imgs)
    create_word(imgs)
    print(f"Successfully generated PPTX and DOCX files with {len(imgs)} images.")
