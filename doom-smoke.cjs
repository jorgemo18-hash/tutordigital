const assert = require("assert");
const { DOMImplementation, XMLSerializer } = require("@xmldom/xmldom");

function smoke() {
  const impl = new DOMImplementation();
  const doc1 = impl.createDocument(null, "root", null);
  const doc2 = impl.createDocument(null, "root2", null);

  const el = doc1.createElement("child");
  el.setAttribute("a", "1");
  doc1.documentElement.appendChild(el);

  // mover nodo entre documentos (ownerDocument debe actualizarse)
  doc2.documentElement.appendChild(el);
  assert.strictEqual(el.ownerDocument, doc2, "ownerDocument should be doc2 after move");

  // serializar
  const s = new XMLSerializer().serializeToString(doc2);
  assert.ok(s.includes("<child"), "serialized output should include child");
  assert.ok(s.includes('a="1"'), "serialized output should include attribute");

  console.log("doom-smoke: OK");
}

smoke();
