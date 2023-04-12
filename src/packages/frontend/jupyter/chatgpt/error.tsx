/*
Use ChatGPT to explain an error message and help the user fix it.
*/

import { CSSProperties } from "react";
import Anser from "anser";
import HelpMeFix from "@cocalc/frontend/frame-editors/chatgpt/help-me-fix";

interface Props {
  actions?;
  id: string;
  style?: CSSProperties;
}

export default function ChatGPTError({ actions, id, style }: Props) {
  return (
    <HelpMeFix
      style={style}
      task="ran a cell in a Jupyter notebook"
      error={() => getError(actions, id)}
      input={() => getInput(actions, id)}
      tag="jupyter-notebook-cell-eval"
    />
  );
}

function getInput(actions, id) {
  return actions.store.getIn(["cells", id, "input"]);
}

function getError(actions, id) {
  const cell = actions.store.getIn(["cells", id]);
  if (cell == null) return "";
  let traceback = "";
  for (const [_n, mesg] of cell.get("output") ?? []) {
    if (mesg.has("traceback")) {
      traceback += mesg.get("traceback").join("\n") + "\n";
    }
  }
  return Anser.ansiToText(traceback.trim());
}
