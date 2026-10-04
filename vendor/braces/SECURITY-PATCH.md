# Local security patch

Based on braces 3.0.3 (MIT), with unchanged package identity for transparent advisory reporting.

GHSA-vfj7-8cjw-p6xm currently has no upstream release. The parser rejects brace and parenthesis nesting at 64 levels before any recursive walker is reached. The compile, expand and stringify entry points also validate supplied ASTs iteratively, rejecting deep, cyclic or oversized node trees. Normal glob semantics remain unchanged below these limits.

Installed through the package.json file override; npm audit may continue to report the upstream advisory because it does not inspect patched source. Regression tests exercise both the installed copy and the local package. Remove the fork once an upstream correction is available.
