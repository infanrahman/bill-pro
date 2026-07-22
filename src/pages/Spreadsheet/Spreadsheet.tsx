import React, { useState } from 'react';
import SpreadsheetList from './SpreadsheetList';
import SheetEditor from './SheetEditor';

const Spreadsheet: React.FC = () => {
 // viewMode: 'list' | 'editor'
 // activeSheetId: number | 'new' | null
 const [activeSheetId, setActiveSheetId] = useState<string | 'new' | null>(null);

 if (activeSheetId !== null) {
 return (
 <SheetEditor
 sheetId={activeSheetId}
 onBack={() => setActiveSheetId(null)}
 />
);
 }

 return (
 <SpreadsheetList
 onSelect={(id) => setActiveSheetId(id)}
 />
);
};

export default Spreadsheet;
