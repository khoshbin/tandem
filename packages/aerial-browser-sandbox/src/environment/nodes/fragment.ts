import { weakMemo } from "aerial-common2";
import { getSEnvParentNodeClass } from "./parent-node";
import { SEnvNodeTypes } from "../constants";

export const getSEnvDocumentFragment = weakMemo((context: any) => {
  const SEnvParentNode = getSEnvParentNodeClass(context);
  return class SEnvDocumentFragment extends SEnvParentNode implements DocumentFragment {
    readonly nodeType = SEnvNodeTypes.DOCUMENT_FRAGMENT;
    $$preconstruct() {
      super.$$preconstruct();
      this.nodeName = "#document-fragment";
    }
    getElementById(elementId: string): HTMLElement | null {
      return null;
    }
    cloneShallow() {
      const clone = this.ownerDocument.createDocumentFragment();
      return clone;
    }
  };
});