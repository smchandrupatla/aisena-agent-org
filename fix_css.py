with open('services/capabilities_site/styles.css', encoding='utf-8') as f:
    css = f.read()
# Change button text to match gradient (use brand color as text)
css = css.replace('button {\n  border: 1px solid var(--brand);\n  background: linear-gradient(135deg, var(--brand), var(--brand-2));\n  color: #fff;', 'button {\n  border: 1px solid var(--brand);\n  background: linear-gradient(135deg, var(--brand), var(--brand-2));\n  color: var(--brand);')
with open('services/capabilities_site/styles.css', 'w', encoding='utf-8') as f:
    f.write(css)
print('css updated')
