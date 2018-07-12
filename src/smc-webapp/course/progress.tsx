/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
Progress indicator for assigning/collecting/etc. a particular assignment or handout.
*/

import { React, rclass, rtypes } from "../app-framework";
import { Icon, Space } from "../r_misc";

import { COLORS } from "smc-util/theme";

import misc from "smc-util/misc";

const progress_info = {
  color: COLORS.GRAY_D,
  marginLeft: "10px",
  whiteSpace: "nowrap"
};

const progress_info_done = misc.copy(progress_info);
progress_info_done.color = COLORS.BS_GREEN_DD;

export let Progress = rclass({
  propTypes: {
    done: rtypes.number,
    not_done: rtypes.number,
    step: rtypes.string,
    skipped: rtypes.bool
  }, // Show skipped text

  render_checkbox() {
    if (this.props.not_done === 0) {
      return (
        <span style={{ fontSize: "12pt" }}>
          <Icon name="check-circle" />
          <Space />
        </span>
      );
    }
  },

  render_status() {
    if (!this.props.skipped) {
      return (
        <React.Fragment>
          ({this.props.done} / {this.props.not_done + this.props.done}{" "}
          {this.props.step})
        </React.Fragment>
      );
    } else {
      return <React.Fragment>Skipped</React.Fragment>;
    }
  },

  render() {
    let style;
    if (
      this.props.done == null ||
      this.props.not_done == null ||
      this.props.step == null
    ) {
      return <span />;
    }
    if (this.props.not_done === 0) {
      style = progress_info_done;
    } else {
      style = progress_info;
    }
    return (
      <span style={style}>
        {this.render_checkbox()}
        {this.render_status()}
      </span>
    );
  }
});
