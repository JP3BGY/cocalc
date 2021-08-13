// Register types for use in server side rendering.

import "./blockquote";
import "./break";
import "./checkbox";
import "./code-block";
import "./emoji";
import "./generic";
import "./hashtag";
import "./heading";
import "./hr";
import "./link";
import "./list";
import "./list/list-item";
import "./math";
import "./meta";
import "./paragraph";

import { Element } from "slate";

export function isElementOfType(x, type: string | string[]): boolean {
  return (
    Element.isElement(x) &&
    ((typeof type == "string" && x["type"] == type) ||
      (typeof type != "string" && type.indexOf(x["type"]) != -1))
  );
}
