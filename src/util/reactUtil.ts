// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from "react";

export const useForceUpdate = () => {
  const [value, setValue] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars
  return () => setValue(value => value + 1);
}

