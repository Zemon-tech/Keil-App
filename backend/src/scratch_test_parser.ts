import { format } from "date-fns";

function getPlainTextFromTiptapJson(jsonStr: string): string {
  if (!jsonStr) return "";
  try {
    const json = JSON.parse(jsonStr);
    if (!json || typeof json !== "object") return jsonStr;
    
    let text = "";
    const traverse = (node: any) => {
      if (node.type === "text" && node.text) {
        text += node.text;
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
      if (["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(node.type)) {
        text += "\n";
      }
    };
    
    if (json.type === "doc" && Array.isArray(json.content)) {
      json.content.forEach(traverse);
    } else {
      traverse(json);
    }
    return text;
  } catch (e) {
    return jsonStr;
  }
}

function parseObjectiveAndSuccessCriteria(descJsonOrText: string) {
  const text = getPlainTextFromTiptapJson(descJsonOrText);
  const lines = text.split("\n");
  let currentSection: "description" | "objective" | "success" = "description";
  const objectiveLines: string[] = [];
  const successLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    
    if (trimmed.match(/^(#+\s+)?objective(s)?$/) || trimmed === "objective:") {
      currentSection = "objective";
      continue;
    }
    
    if (trimmed.match(/^(#+\s+)?success\s+criteria$/) || trimmed === "success criteria:") {
      currentSection = "success";
      continue;
    }
    
    if (trimmed.match(/^(#+\s+)?(description|agenda|notes)$/) || trimmed === "description:") {
      currentSection = "description";
      continue;
    }

    if (currentSection === "objective") {
      objectiveLines.push(line);
    } else if (currentSection === "success") {
      successLines.push(line);
    }
  }

  const cleanSectionText = (linesArr: string[]) => {
    return linesArr
      .map(l => l.trim())
      .map(l => l.replace(/^[•\-\*·]\s*/, "")) // include middle dot '·'
      .filter(l => l !== "")
      .join("\n");
  };

  return {
    objective: cleanSectionText(objectiveLines),
    successCriteria: cleanSectionText(successLines),
  };
}

// Test case simulating the Tiptap JSON output with bullet lists and paragraphs
const sampleTiptapJson = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Objective" }]
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Hola" }]
            }
          ]
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "hola" }]
            }
          ]
        }
      ]
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Success Criteria" }]
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "hola" }]
            }
          ]
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "loa" }]
            }
          ]
        }
      ]
    }
  ]
});

console.log("Extracted Plain Text:");
console.log(JSON.stringify(getPlainTextFromTiptapJson(sampleTiptapJson)));
console.log("\nParsed Clarity Fields:");
console.log(parseObjectiveAndSuccessCriteria(sampleTiptapJson));
