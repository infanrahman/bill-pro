const fs = require('fs');
const path = require('path');

const localesPath = path.join('d:', 'mobile', 'src', 'locales');

const langs = [
    {
        file: 'en.json',
        keys: {
            categories: "Categories",
            add_category: "Add Category",
            edit_category: "Edit Category",
            new_category: "New Category",
            save_category: "Save Category",
            category_name: "Name",
            category_desc: "Description",
            category_updated: "Category updated successfully",
            category_created: "Category created successfully",
            category_save_error: "Failed to save category",
            category_deleted: "Category deleted",
            category_delete_error: "Failed to delete category",
            category_delete_confirm: "Are you sure you want to delete this category?",
            no_categories: "No Categories Found",
            no_categories_desc: "Create categories to organize your items."
        }
    },
    {
        file: 'ar.json',
        keys: {
            categories: "الفئات",
            add_category: "إضافة فئة",
            edit_category: "تعديل الفئة",
            new_category: "فئة جديدة",
            save_category: "حفظ الفئة",
            category_name: "الاسم",
            category_desc: "الوصف",
            category_updated: "تم تحديث الفئة بنجاح",
            category_created: "تم إنشاء الفئة بنجاح",
            category_save_error: "فشل حفظ الفئة",
            category_deleted: "تم حذف الفئة",
            category_delete_error: "فشل حذف الفئة",
            category_delete_confirm: "هل أنت متأكد من أنك تريد حذف هذه الفئة؟",
            no_categories: "لا توجد فئات",
            no_categories_desc: "قم بإنشاء فئات لتنظيم عناصرك."
        }
    },
    {
        file: 'hi.json',
        keys: {
            categories: "श्रेणियाँ",
            add_category: "श्रेणी जोड़ें",
            edit_category: "श्रेणी संपादित करें",
            new_category: "नई श्रेणी",
            save_category: "श्रेणी सहेजें",
            category_name: "नाम",
            category_desc: "विवरण",
            category_updated: "श्रेणी सफलतापूर्वक अपडेट की गई",
            category_created: "श्रेणी सफलतापूर्वक बनाई गई",
            category_save_error: "श्रेणी सहेजने में विफल",
            category_deleted: "श्रेणी हटा दी गई",
            category_delete_error: "श्रेणी हटाने में विफल",
            category_delete_confirm: "क्या आप वाकई इस श्रेणी को हटाना चाहते हैं?",
            no_categories: "कोई श्रेणियाँ नहीं मिलीं",
            no_categories_desc: "अपने आइटम व्यवस्थित करने के लिए श्रेणियाँ बनाएँ।"
        }
    },
    {
        file: 'bn.json',
        keys: {
            categories: "ক্যাটাগরি",
            add_category: "ক্যাটাগরি যোগ করুন",
            edit_category: "ক্যাটাগরি সম্পাদনা করুন",
            new_category: "নতুন ক্যাটাগরি",
            save_category: "ক্যাটাগরি সংরক্ষণ করুন",
            category_name: "নাম",
            category_desc: "বিবরণ",
            category_updated: "ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে",
            category_created: "ক্যাটাগরি সফলভাবে তৈরি করা হয়েছে",
            category_save_error: "ক্যাটাগরি সংরক্ষণে ত্রুটি",
            category_deleted: "ক্যাটাগরি মুছে ফেলা হয়েছে",
            category_delete_error: "ক্যাটাগরি মুছতে ব্যর্থ",
            category_delete_confirm: "আপনি কি নিশ্চিত যে আপনি এই ক্যাটাগরিটি মুছতে চান?",
            no_categories: "কোন ক্যাটাগরি পাওয়া যায়নি",
            no_categories_desc: "আপনার আইটেমগুলি সাজানোর জন্য ক্যাটাগরি তৈরি করুন।"
        }
    }
];

langs.forEach(({ file, keys }) => {
    const filePath = path.join(localesPath, file);
    if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        try {
            const data = JSON.parse(raw);
            if (data.inventory) {
                // Merge keys
                data.inventory = { ...data.inventory, ...keys };
                fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
                console.log(`Updated ${file}`);
            }
        } catch (e) {
            console.error(`Error parsing ${file}`, e);
        }
    }
});
