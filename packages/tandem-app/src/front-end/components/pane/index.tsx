import "./index.scss";
import * as React from "react";
import { pure, compose } from "recompose";
import { Component } from "front-end/components/types";
const cx = require("classnames");

// TODOS
// collapsible
const enhancePane = pure;

export type PaneProps = {
  title: any;
  controls?: any;
  children: any;
  className?: string;
}

export const PaneBase = ({ title, controls, children, className }: PaneProps) => <div className={cx("m-pane", className)}>
  <div className="header">
    { title } <span className="controls">{ controls }</span>
  </div>
  <div className="body">
    { children }
  </div>
</div>;

export const Pane = enhancePane(PaneBase);
