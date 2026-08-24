with open('services/capabilities_site/tasks.html', encoding='utf-8') as f:
    html = f.read()
quick = '<article class="card span-6 fade-up">\n          <h3>Quick Actions</h3>\n          <div class="pill-list">\n            <button type="button" class="pill" id="quickAddTask">Add Task</button>\n            <button type="button" class="pill" id="uploadTasksButton">Upload Tasks</button>\n            <button type="button" class="pill" id="quickAssignOwner">Assign owner</button>\n            <button type="button" class="pill" id="quickSetDependency">Set dependency</button>\n            <button type="button" class="pill" id="quickLogHandoff">Log handoff</button>\n          </div>\n        </article>'
html = html.replace(quick, '')
html = html.replace('<section class="grid">', quick + '\n      <section class="grid">')
with open('services/capabilities_site/tasks.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('tasks.html updated')
