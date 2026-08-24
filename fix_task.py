with open('services/capabilities_site/task.html', encoding='utf-8') as f:
    html = f.read()
nav = '<div class="kicker"><a href="tasks.html" style="color: inherit;">&larr; Back to Tasks</a></div>'
new_nav = '<div class="kicker" style="display:flex; gap:12px; align-items:center;">\n        <a href="tasks.html" style="color: inherit;">&larr; Back</a>\n        <a href="#" onclick="history.back(); return false;" style="color: inherit;">Next &rarr;</a>\n      </div>'
html = html.replace(nav, new_nav)
with open('services/capabilities_site/task.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('task.html updated')
