/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import path from "path";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import license from "rollup-plugin-license";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import babel from "rollup-plugin-babel";
import visualizer from "rollup-plugin-visualizer";
import pkg from "./package.json";

function getPlugins(babelConfig, visualizerConfig) {
  return [
    json(),
    resolve({}),
    commonjs(),
    license({
      banner: {
        content: {
          file: path.join(__dirname, "LICENSE_BANNER.txt")
        }
      }
    }),
    babel(babelConfig),
    terser(),
    visualizer(visualizerConfig)
  ];
}

export default [
  {
    input: "src/index.browser.js",
    output: {
      name: "TargetClient",
      file: pkg.browser,
      format: "umd",
      sourcemap: true
    },
    plugins: getPlugins(
      {
        inputSourceMap: true,
        sourceMaps: true,
        exclude: ["node_modules/**", /\/core-js\//],

        presets: [
          [
            "@babel/preset-env",
            {
              useBuiltIns: "usage",
              corejs: 3,
              modules: false,
              targets: {
                browsers: [
                  "last 2 Chrome versions",
                  "last 2 Firefox versions",
                  "last 2 Safari versions",
                  "Explorer >= 10"
                ]
              }
            }
          ]
        ],
        plugins: ["@babel/plugin-transform-regenerator"]
      },
      {
        filename: "bundlesize-stats.browser.html"
      }
    )
  },
  {
    input: "src/index.server.js",
    output: {
      name: "TargetClient",
      file: pkg.main,
      format: "cjs"
    },
    external: [...Object.keys(pkg.dependencies || {})],
    plugins: getPlugins(
      {
        exclude: "node_modules/**",

        presets: [
          [
            "@babel/preset-env",
            {
              useBuiltIns: false,
              modules: false,
              targets: {
                node: "8"
              }
            }
          ]
        ],
        plugins: []
      },
      {
        filename: "bundlesize-stats.server.html"
      }
    )
  }
];
