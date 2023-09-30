# Usage: . utils/generate-all.sh

# enable echo
set -x

# grammar parser data for advanced parser builder
time ts-node utils/generate-serialized-grammar-parser.ts

# example/parser/advanced-builder
time ts-node examples/parser/advanced-builder/mermaid-gen.ts
time ts-node examples/parser/advanced-builder/parser-data-gen.ts

# example/parser/json
time ts-node examples/parser/json/mermaid-gen.ts
time ts-node examples/parser/json/parser-data-gen.ts

# example/parser/calculator
time ts-node examples/parser/calculator/mermaid-gen.ts
time ts-node examples/parser/calculator/parser-data-gen.ts

# example/parser/simple-ts-parser
time ts-node examples/parser/simple-ts-parser/mermaid-gen.ts
time ts-node examples/parser/simple-ts-parser/parser-data-gen.ts

# disable echo
set +x