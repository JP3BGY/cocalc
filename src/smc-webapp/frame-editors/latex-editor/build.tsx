/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Show the last latex build log, i.e., output from last time we ran the LaTeX build process.
*/

import Ansi from "ansi-to-react";
import { path_split } from "@cocalc/util/misc";
import { React, Rendered, useRedux } from "../../app-framework";
import { BuildCommand } from "./build-command";
import { IconName, Loading } from "smc-webapp/r_misc";
import { Tab, Tabs } from "../../antd-bootstrap";
import { COLORS } from "@cocalc/util/theme";
import { BuildLogs } from "./actions";
import { use_build_logs } from "./hooks";

interface IBuildSpec {
  button: boolean;
  label: string;
  icon: IconName;
  tip: string;
}

export interface IBuildSpecs {
  build: IBuildSpec;
  latex: IBuildSpec;
  bibtex: IBuildSpec;
  sagetex: IBuildSpec;
  pythontex: IBuildSpec;
  knitr: IBuildSpec;
  clean: IBuildSpec;
}

const BUILD_SPECS: IBuildSpecs = {
  build: {
    button: true,
    label: "Build",
    icon: "retweet",
    tip: "Build the document, running LaTeX, BibTex, Sage, etc.",
  },

  latex: {
    button: false,
    label: "LaTeX",
    icon: "tex-file",
    tip: "Run the LaTeX build command (typically latexmk)",
  },

  bibtex: {
    button: false,
    label: "BibTeX",
    icon: "file-code",
    tip: "Process bibliography using Bibtex",
  },

  sagetex: {
    button: false,
    label: "SageTex",
    icon: "sagemath-bold",
    tip: "Run SageTex, if necessary",
  },

  pythontex: {
    button: false,
    label: "PythonTeX",
    icon: "python",
    tip: "Run PythonTeX3, if necessary",
  },

  knitr: {
    button: false,
    label: "Knitr",
    icon: "r",
    tip: "Run Knitr, if necessary",
  },

  clean: {
    button: true,
    label: "Clean",
    icon: "trash",
    tip: "Delete all autogenerated auxiliary files",
  },
};

interface Props {
  name: string;
  actions: any;
  path: string;
  font_size: number;
  status: string;
}

export const Build: React.FC<Props> = React.memo((props) => {
  const { name, actions, path, font_size: font_size_orig, status } = props;

  const font_size = 0.8 * font_size_orig;
  const build_logs: BuildLogs = use_build_logs(name);
  const build_command = useRedux([name, "build_command"]);
  const knitr: boolean = useRedux([name, "knitr"]);
  const [active_tab, set_active_tab] = React.useState<string>(
    BUILD_SPECS.latex.label
  );
  const [error_tab, set_error_tab] = React.useState(null);
  let no_errors = true;

  function render_tab_body(
    title: string,
    value: string,
    error?: boolean,
    time_str?: string
  ) {
    const style: React.CSSProperties = {
      fontFamily: "monospace",
      whiteSpace: "pre-line",
      color: COLORS.GRAY_D,
      background: COLORS.GRAY_LLL,
      display: active_tab === title ? "block" : "none",
      width: "100%",
      padding: "5px",
      fontSize: `${font_size}px`,
      overflowY: "auto",
      margin: "0",
    };
    const err_style = error ? { background: COLORS.ATND_BG_RED_L } : undefined;
    const tab_button = <div style={err_style}>{title}</div>;
    return (
      <Tab key={title} eventKey={title} title={tab_button} style={style}>
        {time_str && `Build time: ${time_str}\n\n`}
        <Ansi>{value}</Ansi>
      </Tab>
    );
  }

  function render_log(stage): Rendered {
    if (build_logs == null) return;
    const x = build_logs.get(stage);
    if (!x) return;
    const value = x.get("stdout") + x.get("stderr");
    if (!value) return;
    const time: number | undefined = x.get("time");
    const time_str = time ? `(${(time / 1000).toFixed(1)} seconds)` : "";
    const title = BUILD_SPECS[stage].label;
    // highlights tab, if there is at least one parsed error
    const error = build_logs.getIn([stage, "parse", "errors"]).size > 0;
    // also show the problematic log to the user
    if (error) {
      no_errors = false;
      if (error_tab == null) {
        set_active_tab(title);
        set_error_tab(title);
      }
    }
    return render_tab_body(title, value, error, time_str);
  }

  function render_clean(): Rendered {
    const value = build_logs?.getIn(["clean", "output"]);
    if (!value) return;
    const title = "Clean Auxiliary Files";
    return render_tab_body(title, value);
  }

  function render_logs(): Rendered {
    if (status) return;
    return (
      <Tabs
        activeKey={active_tab}
        onSelect={set_active_tab}
        tabPosition={"left"}
        size={"small"}
        style={{ height: "100%", overflowY: "auto" }}
      >
        {render_log("latex")}
        {render_log("sagetex")}
        {render_log("pythontex")}
        {render_log("knitr")}
        {render_log("bibtex")}
        {render_clean()}
      </Tabs>
    );
  }

  function render_build_command(): Rendered {
    return (
      <BuildCommand
        font_size={font_size}
        filename={path_split(path).tail}
        actions={actions}
        build_command={build_command}
        knitr={knitr}
      />
    );
  }

  function render_status(): Rendered {
    if (status) {
      return (
        <div style={{ margin: "15px" }}>
          <Loading
            text={status}
            style={{
              fontSize: "10pt",
              textAlign: "center",
              marginTop: "15px",
              color: COLORS.GRAY,
            }}
          />
        </div>
      );
    }
  }

  // if all errors are fixed, clear the state remembering we had an active error tab
  const logs = render_logs();
  if (no_errors && error_tab != null) set_error_tab(null);

  return (
    <div
      className={"smc-vfill cocalc-latex-build-content"}
      style={{
        overflow: "hidden",
        padding: "5px 0 0 5px",
        fontSize: `${font_size}px`,
      }}
    >
      {render_build_command()}
      {render_status()}
      {logs}
    </div>
  );
});
