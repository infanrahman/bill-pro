import re

with open('d:/mobile/src/pages/Purchase/PurchaseOrders.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# normalize line endings
content = content.replace('\r\n', '\n')

main_return_match = re.search(r'return\s*\(\s*<div className="space-y-6">', content)
if not main_return_match:
    main_return_match = re.search(r'return\s*\(\s*<div className="space-y-8 pb-10">', content)

if not main_return_match:
    print("Could not find main return")
    exit(1)
main_return_idx = main_return_match.start()

modal_start_match = re.search(r'\{\/\*\s*Create Modal\s*\*\/\}\s*<Modal\s*isOpen=\{isModalOpen\}', content)
if not modal_start_match:
    print("Could not find modal start")
    exit(1)
modal_start_idx = modal_start_match.start()

modal_end_match = re.search(r'\{\/\*\s*Quick Add Supplier Modal\s*\*\/\}', content[modal_start_idx:])
if not modal_end_match:
    print("Could not find modal end")
    exit(1)
modal_end_idx = modal_start_idx + modal_end_match.start()

modal_block = content[modal_start_idx:modal_end_idx].strip()
content = content[:modal_start_idx] + content[modal_end_idx:]

modal_block = re.sub(
    r'\{\/\*\s*Create Modal\s*\*\/\}\s*<Modal[^>]+>', 
    """if (isModalOpen) {
    return (
      <div className="absolute inset-0 z-[60] bg-slate-50 dark:bg-slate-900 flex flex-col fade-in">
        <div className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors">
              <ArrowLeft size={24} className="text-slate-700 dark:text-slate-300" />
            </button>
            <h2 className="text-2xl font-bold dark:text-white uppercase tracking-tight">
              {activeTab === 'bill' ? t('purchases.new_bill') : activeTab === 'return' ? t('purchases.new_return') : t('purchases.new_order')}
            </h2>
          </div>
        </div>""",
    modal_block
)

modal_block = modal_block.replace('</Modal>', '</div>\n    );\n  }\n')

if 'ArrowLeft' not in content:
    content = content.replace("import { ", "import { ArrowLeft, ", 1)

final_content = content[:main_return_idx] + modal_block + "\n\n    " + content[main_return_idx:]

with open('d:/mobile/src/pages/Purchase/PurchaseOrders.tsx', 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Successfully refactored PurchaseOrders.tsx")
