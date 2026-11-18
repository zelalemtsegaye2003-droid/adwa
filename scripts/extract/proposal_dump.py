#!/usr/bin/env python3
"""Dump the Adwa Cyber proposal text + tables in document order for analysis."""
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

doc = Document('upload/Adwa_Cyber_Startup_Proposal.docx')


def iter_blocks(parent):
    body = parent.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)


out = []
ti = 0
for block in iter_blocks(doc):
    if isinstance(block, Paragraph):
        t = block.text.strip()
        if t:
            style = block.style.name if block.style else ''
            prefix = '## ' if 'Heading' in style else ''
            out.append(prefix + t)
    else:
        ti += 1
        out.append(f'\n===== TABLE {ti} =====')
        for row in block.rows:
            cells = [c.text.strip().replace('\n', ' / ') for c in row.cells]
            out.append(' | '.join(cells))
        out.append(f'===== END TABLE {ti} =====\n')

text = '\n'.join(out)
with open('scripts/extract/proposal_full.txt', 'w', encoding='utf-8') as f:
    f.write(text)
print(f'wrote {len(text)} chars, {ti} tables')
import re
for m in re.finditer(r'===== TABLE (\d+) =====\n(.{0,300})', text, re.S):
    n, head = m.group(1), m.group(2).replace('\n', ' ')[:200]
    print(f'T{n}: {head}')
