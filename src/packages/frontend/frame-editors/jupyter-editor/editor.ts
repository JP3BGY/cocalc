/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Spec for editing Jupyter notebooks via a frame tree.
*/

import { createElement } from "react";
import { set } from "@cocalc/util/misc";
import { createEditor } from "../frame-tree/editor";
import { EditorDescription } from "../frame-tree/types";
import { terminal } from "../terminal-editor/editor";
import { time_travel } from "../time-travel-editor/editor";
import { CellNotebook } from "./cell-notebook/cell-notebook";
import { RawIPynb } from "./raw-ipynb";
import JSONIPynb from "./json-ipynb";
import { Slideshow } from "./slideshow-revealjs/slideshow";
import { TableOfContents } from "./table-of-contents";
import { Introspect } from "./introspect/introspect";
const SNIPPET_ICON_NAME =
  require("@cocalc/frontend/assistant/common").ICON_NAME;
import { JupyterSnippets } from "./snippets";
import {
  addCommands,
  addMenus,
} from "@cocalc/frontend/frame-editors/frame-tree/commands";
import type {
  Command,
  Menus,
} from "@cocalc/frontend/frame-editors/frame-tree/commands";
import { commands, AllActions } from "@cocalc/frontend/jupyter/commands";
import { shortcut_to_string } from "@cocalc/frontend/jupyter/keyboard-shortcuts";
import KernelMenuItem from "./kernel-menu-item";

const jupyterCommands = set([
  "chatgpt",
  "print",
  "set_zoom",
  "decrease_font_size",
  "increase_font_size",
  "save",
  "time_travel",
  "undo",
  "redo",
  "halt_jupyter",
  "show_table_of_contents",
  "guide",
  "shell",
  "terminal",
  "help",
  "compute_server",
]);

export const EDITOR_SPEC = {
  jupyter_cell_notebook: {
    short: "Jupyter",
    name: "Jupyter Notebook",
    icon: "ipynb",
    component: CellNotebook,
    buttons: jupyterCommands,
    customize_buttons: {
      guide: {
        label: "Snippets",
        icon: SNIPPET_ICON_NAME,
        title: "Open a panel containing code snippets.",
      },
      shell: {
        label: "Jupyter Console",
        icon: "ipynb",
        title:
          "Open the Jupyter command line console connected to the running kernel.",
      },
    },
  } as EditorDescription,
  commands_guide: {
    short: "Snippets",
    name: "Snippets",
    icon: SNIPPET_ICON_NAME,
    component: JupyterSnippets,
    buttons: set(["decrease_font_size", "increase_font_size"]),
  } as EditorDescription,
  jupyter_slideshow_revealjs: {
    short: "Slideshow",
    name: "Slideshow (Reveal.js)",
    icon: "slides",
    component: Slideshow,
    buttons: set(["build"]),
  } as EditorDescription,
  jupyter_table_of_contents: {
    short: "Contents",
    name: "Table of Contents",
    icon: "align-right",
    component: TableOfContents,
    buttons: set(["decrease_font_size", "increase_font_size"]),
  } as EditorDescription,
  introspect: {
    short: "Introspect",
    name: "Introspection",
    icon: "info",
    component: Introspect,
    buttons: set(["decrease_font_size", "increase_font_size"]),
  } as EditorDescription,
  terminal,
  time_travel,
  jupyter_json: {
    short: "JSON view",
    name: "Raw JSON viewer",
    icon: "js-square",
    component: JSONIPynb,
    buttons: set(["decrease_font_size", "increase_font_size"]),
  } as EditorDescription,
  jupyter_raw: {
    short: "JSON edit",
    name: "Raw JSON editor",
    icon: "markdown",
    component: RawIPynb,
    buttons: set(["decrease_font_size", "increase_font_size"]),
  } as EditorDescription,
};

const JUPYTER_MENUS = {
  edit: {
    label: "Edit",
    pos: 1,
    "cell-copy": [
      "cut cell",
      "copy cell",
      {
        icon: "paste",
        name: "paste-cells",
        label: "Paste Cells",
        children: [
          "paste cell and replace",
          "paste cell above",
          "paste cell below",
        ],
      },
    ],
    "insert-delete": [
      {
        label: "Insert Cell",
        name: "insert-cell",
        icon: "plus",
        children: ["insert cell above", "insert cell below"],
      },
      {
        label: "Delete Cells",
        name: "delete-cell",
        children: ["delete cell", "delete all blank code cells"],
      },
    ],
    "cell-selection": [
      {
        label: "Select Cells",
        name: "select",
        children: ["select all cells", "deselect all cells"],
      },
    ],
    "cell-type": [
      {
        name: "cell-type",
        label: "Cell Type",
        children: [
          "change cell to code",
          "change cell to markdown",
          "change cell to raw",
        ],
      },
    ],
    "move-cells": [
      {
        name: "move",
        label: "Move Cells",
        children: ["move cell up", "move cell down"],
      },
    ],
    "split-and-merge-cells": [
      {
        name: "split-merge-cells",
        label: "Split and Merge",
        children: [
          "split cell at cursor",
          "merge cell with previous cell",
          "merge cell with next cell",
          "merge cells",
        ],
      },
    ],
    "clear-cells": [
      {
        name: "clear",
        label: "Clear Output",
        children: [
          "clear cell output",
          "clear all cells output",
          "confirm restart kernel and clear output",
        ],
      },
    ],
    find: ["find and replace"],
    "format-cells": [
      {
        label: "Format Cells",
        name: "cell-format",
        children: ["format cells", "format all cells"],
      },
    ],
    "cell-toggle": [
      {
        label: "Toggle Selected Cells",
        name: "cell-toggle",
        children: [
          "toggle hide input",
          "toggle hide output",
          "write protect",
          "delete protect",
        ],
      },
    ],
    "insert-image": ["insert image"],
  },
  jupyter_run: {
    label: "Run",
    pos: 4,
    "run-cells": ["run cell and select next"],
    "run-cells-2": ["run cell and insert below", "run cell"],
    "run-cells-adjacent": ["run all cells above", "run all cells below"],
    "run-cells-all": [
      "run all cells",
      "confirm restart kernel and run all cells",
    ],
  },
  jupyter_kernel: {
    label: "Kernel",
    pos: 5,
    "kernel-control": ["interrupt kernel"],
    "restart-kernel": [
      {
        label: "Restart Kernel",
        name: "restart",
        children: [
          "confirm restart kernel",
          "confirm restart kernel and clear output",
          "confirm restart kernel and run all cells",
        ],
      },
      "confirm restart kernel and run all cells without halting on error",
    ],
    "shutdown-kernel": ["confirm shutdown kernel"],
    kernels: [
      {
        label: ({ props }) => {
          const actions = props.actions.jupyter_actions;
          const store = actions.store;
          if (!store) {
            return "Kernels";
          }
          const kernels = store.get("kernels_by_name")?.toJS();
          const currentKernel = store.get("kernel");
          if (kernels == null || currentKernel == null) {
            actions.fetch_jupyter_kernels();
            return "Kernels";
          }
          return createElement(KernelMenuItem, {
            ...kernels[currentKernel],
            currentKernel,
          });
        },
        name: "kernels",
        children: ({ props }) => {
          const actions = props.actions.jupyter_actions;
          const store = actions.store;
          if (!store) {
            return [];
          }
          const kernels = store.get("kernels_by_name")?.toJS();
          const currentKernel = store.get("kernel");
          if (kernels == null) {
            actions.fetch_jupyter_kernels();
            return [];
          }
          const v: Partial<Command>[] = [];
          const addKernel = (kernelName: string) => {
            v.push({
              label: createElement(KernelMenuItem, {
                ...kernels[kernelName],
                currentKernel,
              }),
              onClick: () => {
                actions.set_kernel(kernelName);
                actions.set_default_kernel(kernelName);
              },
            });
          };
          for (const kernelName in kernels) {
            addKernel(kernelName);
          }
          return v;
        },
      },
      "refresh kernels",
      "change kernel",
    ],
    "no-kernel": ["no kernel"],
    "custom-kernel": ["custom kernel"],
  },
};

function initMenus() {
  const MENUS: Menus = {};
  const COMMANDS: {
    [name: string]: { group: string; pos: number; children?; label?; icon? };
  } = {};
  for (const menu in JUPYTER_MENUS) {
    const spec = JUPYTER_MENUS[menu];
    const groups: string[] = [];
    for (const group in spec) {
      if (group != "label" && group != "pos") {
        const gp = `jupyter-${group}`;
        groups.push(gp);
        let pos = -1;
        for (const cmd of spec[group]) {
          pos += 1;
          if (typeof cmd == "string") {
            COMMANDS[cmd] = { group: gp, pos };
          } else {
            // submenu
            const { name, label, children, icon } = cmd;
            COMMANDS[name] = { group: gp, pos, children, label, icon };
          }
        }
      }
    }
    MENUS[menu] = { label: spec.label, pos: spec.pos, groups };
  }

  // organization of the commands into groups
  // console.log("add Menus", MENUS);
  addMenus(MENUS);

  // the commands
  const allActions: AllActions = {};
  const allCommands = commands(allActions);
  const C: { [name: string]: Command } = {};
  for (const name in COMMANDS) {
    const { group, pos, children, label, icon } = COMMANDS[name];
    const cmdName = `jupyter-${name}`;
    if (children == null) {
      const cmd = allCommands[name];
      if (cmd == null) {
        throw Error(`invalid Jupyter command name "${name}"`);
      }
      C[cmdName] = {
        pos,
        title: cmd.t,
        label: cmd.m,
        group,
        icon: cmd.i,
        keyboard: cmd.k ? cmd.k.map(shortcut_to_string).join(", ") : undefined,
        onClick: ({ props }) => {
          allActions.frame_actions = props.actions.frame_actions?.[props.id];
          allActions.jupyter_actions = props.actions.jupyter_actions;
          allActions.editor_actions = props.actions;
          cmd.f();
        },
      };
    } else {
      let childCommands;
      if (typeof children == "function") {
        childCommands = children;
        console.log("child is function for ", name);
      } else {
        childCommands = [] as Partial<Command>[];
        for (const childName of children) {
          const cmd = allCommands[childName];
          childCommands.push({
            title: cmd.t,
            label: cmd.m,
            icon: cmd.i,
            onClick: ({ props }) => {
              allActions.frame_actions =
                props.actions.frame_actions?.[props.id];
              allActions.jupyter_actions = props.actions.jupyter_actions;
              allActions.editor_actions = props.actions;
              cmd.f();
            },
          });
        }
      }
      C[cmdName] = {
        pos,
        label,
        group,
        icon,
        children: childCommands,
      };
    }
    jupyterCommands[cmdName] = true;
  }
  // console.log("adding commands", C);
  addCommands(C);
}

initMenus();

export const Editor = createEditor({
  format_bar: false,
  editor_spec: EDITOR_SPEC,
  display_name: "JupyterNotebook",
});
