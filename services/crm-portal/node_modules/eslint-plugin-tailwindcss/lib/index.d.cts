import * as _typescript_eslint_utils_ts_eslint from '@typescript-eslint/utils/ts-eslint';
import { FlatConfig } from '@typescript-eslint/utils/ts-eslint';

type MessageIds = "issue:unknown-classname" | "fix:unknown-classname:remove";
type RuleOptions$1 = {
    whitelist: Array<string>;
};

type RuleOptions = {};

declare const plugin: {
    meta: {
        name: string;
        version: string;
    };
    configs: {
        readonly recommended: FlatConfig.Config | FlatConfig.ConfigArray;
    };
    rules: {
        "classnames-order": _typescript_eslint_utils_ts_eslint.RuleModule<"fix:sort", [RuleOptions], unknown, _typescript_eslint_utils_ts_eslint.RuleListener>;
        "no-custom-classname": _typescript_eslint_utils_ts_eslint.RuleModule<MessageIds, [RuleOptions$1], unknown, _typescript_eslint_utils_ts_eslint.RuleListener>;
    };
};

export = plugin;
