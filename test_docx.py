from docx import Document
from docx.shared import Pt

doc = Document()
p = doc.add_paragraph('Test')
doc.save(r'F:\MotiBuddy1\test.docx')
print('File created')
