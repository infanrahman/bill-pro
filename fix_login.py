import re

with open('src/pages/Login.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove overflow-hidden from main container on mobile, keep it on desktop
content = content.replace(
    'className="flex flex-col md:flex-row min-h-screen w-full font-sans bg-white dark:bg-slate-950 overflow-hidden"',
    'className="flex flex-col md:flex-row min-h-screen w-full font-sans bg-white dark:bg-slate-950 overflow-y-auto overflow-x-hidden md:overflow-hidden"'
)

# Left Side - allow it to be natural height on mobile, h-screen on desktop. 
# Better yet, hide it on very small screens, but let's just make it auto height for now with some padding.
content = content.replace(
    'className="w-full md:w-5/12 bg-slate-900 dark:bg-black p-12 md:p-20 text-white flex flex-col justify-center relative overflow-hidden h-screen"',
    'className="hidden md:flex w-full md:w-5/12 bg-slate-900 dark:bg-black p-12 md:p-20 text-white flex-col justify-center relative overflow-hidden h-screen"'
)

# Right Side - h-screen relative -> min-h-screen md:h-screen relative
content = content.replace(
    'className="w-full md:w-7/12 p-6 md:p-24 flex flex-col justify-center bg-white dark:bg-slate-900 h-screen relative"',
    'className="w-full md:w-7/12 p-6 md:p-24 flex flex-col justify-center bg-white dark:bg-slate-900 min-h-screen md:h-screen relative"'
)

with open('src/pages/Login.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Login fixed')
