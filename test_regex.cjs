const xml = '<cac:AdditionalDocumentReference><cbc:ID>QR</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">OLD_QR</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>';
const correctQrBase64 = 'NEW_QR';
const patchedXml = xml.replace(/(<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>)[^<]*(<\/cbc:EmbeddedDocumentBinaryObject>)/, '$1' + correctQrBase64 + '$2');
console.log(patchedXml);
