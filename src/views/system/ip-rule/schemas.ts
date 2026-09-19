import { IP_RULE_STATUS_OPTIONS, IP_RULE_TYPE_OPTIONS } from "./constants";

import type { FormSchema } from "~/components/business/Form";

/** IP 规则弹窗表单 schema */
export const ipRuleFormSchemas: FormSchema[] = [
  {
    field: "ruleType",
    label: "规则类型",
    component: "RadioGroup",
    required: true,
    defaultValue: "white",
    componentProps: {
      optionType: "button",
      buttonStyle: "solid",
      options: IP_RULE_TYPE_OPTIONS,
    },
  },
  {
    field: "ipPattern",
    label: "IP / CIDR",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：192.168.1.1 或 192.168.1.0/24" },
  },
  {
    field: "status",
    label: "状态",
    component: "RadioGroup",
    defaultValue: "1",
    componentProps: {
      optionType: "button",
      buttonStyle: "solid",
      options: IP_RULE_STATUS_OPTIONS,
    },
  },
  {
    field: "remark",
    label: "备注",
    component: "InputTextArea",
    componentProps: { rows: 3 },
  },
];
