import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";

// Blindagem contra a tela branca do Google Tradutor (celular):
// o tradutor reescreve o DOM e o React tenta removeChild/insertBefore de nós que
// o tradutor já moveu, estourando "NotFoundError". Aqui tornamos essas duas
// operações tolerantes (não quebram a árvore toda). É o fix conhecido p/ apps React.
(function blindarDOMContraTradutor() {
  if (typeof Node !== "function" || !Node.prototype) return;

  const origRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      // nó não é mais filho (tradutor moveu) → não estoura, só devolve
      return child;
    }
    return origRemoveChild.call(this, child) as T;
  };

  const origInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      // referência não é mais filho → anexa no fim em vez de estourar
      return this.appendChild(newNode) as T;
    }
    return origInsertBefore.call(this, newNode, referenceNode) as T;
  };
})();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
