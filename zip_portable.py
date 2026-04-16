import shutil
import os

source_dir = "release/win-unpacked"
output_filename = "dist/Billing-App-Portable"

print(f"Zipping {source_dir} to {output_filename}.zip...")
try:
    shutil.make_archive(output_filename, 'zip', source_dir)
    print("Zip created successfully.")
except Exception as e:
    print(f"Error: {e}")
