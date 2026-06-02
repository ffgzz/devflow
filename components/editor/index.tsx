"use client";

import {
  BoldItalicUnderlineToggles,
  ChangeCodeMirrorLanguage,
  codeBlockPlugin,
  codeMirrorPlugin,
  ConditionalContents,
  CreateLink,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
// basicDark 是 MDXEditor 提供的一个预定义的暗色主题，包含了一套适用于暗色模式的样式和配色方案。通过应用 basicDark 主题，我们可以确保编辑器在暗色模式下具有良好的视觉效果和一致的用户体验。
import { basicDark } from "cm6-theme-basic-dark";
import { useTheme } from "next-themes";
import type { ForwardedRef } from "react";
import "./dark-editor.css";

interface Props {
  value: string;
  fieldChange: (value: string) => void;
  editorRef: ForwardedRef<MDXEditorMethods> | null;
}

// Editor 组件是一个基于 MDXEditor 的富文本编辑器组件，提供了丰富的编辑功能和自定义工具栏按钮。通过集成各种插件，我们可以满足用户在编辑内容时的多样化需求，同时通过动态主题支持确保在不同主题下都具有良好的视觉效果和一致的用户体验。
// 主要用于提问页面和问题页面的回答
const Editor = ({ value, fieldChange, editorRef, ...props }: Props) => {
  const { resolvedTheme } = useTheme();
  // MDXEditor 的 codeMirrorPlugin 插件支持 CodeMirror 编辑器的主题定制。
  // 通过根据当前主题动态选择是否应用 basicDark 主题，我们可以确保编辑器在不同主题下都具有良好的视觉效果和一致的用户体验。
  const theme = resolvedTheme === "dark" ? [basicDark] : [];

  return (
    <MDXEditor
      key={resolvedTheme}
      markdown={value}
      onChange={fieldChange}
      className="background-light800_dark200 light-border-2 markdown-editor dark-editor w-full border"
      // MDXEditor 内置了多种插件，提供了丰富的编辑功能。根据需求选择合适的插件进行配置
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        quotePlugin(),
        // thematicBreakPlugin 插件允许用户插入水平分割线，常用于分隔内容块。
        thematicBreakPlugin(),
        // markdownShortcutPlugin 插件提供了 Markdown 风格的快捷输入功能，例如输入 `**bold**` 会自动转换为加粗文本。这大大提升了编辑效率，尤其对于习惯使用 Markdown 的用户来说非常友好。
        markdownShortcutPlugin(),
        tablePlugin(),
        imagePlugin(),
        // codeBlockPlugin 只是让编辑器支持代码块的基本功能，而 codeMirrorPlugin 则集成了功能更强大的 CodeMirror 编辑器，为代码块提供了更好的编辑体验和更多的功能选项。
        codeBlockPlugin(),
        // codeMirrorPlugin 插件集成了 CodeMirror 编辑器，为代码块提供了更强大的编辑功能和更好的用户体验。它支持语法高亮、自动缩进、代码折叠等功能，使得在编辑代码块时更加便捷和高效。
        codeMirrorPlugin({
          codeBlockLanguages: {
            css: "css",
            txt: "txt",
            sql: "sql",
            html: "html",
            sass: "sass",
            scss: "scss",
            bash: "bash",
            json: "json",
            js: "javascript",
            ts: "typescript",
            "": "unspecified",
            tsx: "TypeScript (React)",
            jsx: "JavaScript (React)",
          },
          // autoLoadLanguageSupport 选项启用后，编辑器会根据用户选择的代码块语言自动加载相应的 CodeMirror 语言支持模块。这意味着用户在选择不同的代码块语言时，编辑器会动态加载所需的语法高亮和其他相关功能，而无需预先加载所有语言支持，从而优化性能。
          autoLoadLanguageSupport: true,
          // 这个选项允许我们为 CodeMirror 编辑器应用自定义的主题。在这个例子中，我们根据当前的主题（light 或 dark）动态选择是否应用 basicDark 主题，以确保编辑器在不同主题下都具有良好的视觉效果和一致的用户体验。
          codeMirrorExtensions: theme,
        }),
        // diffSourcePlugin 插件提供了一个切换按钮，允许用户在富文本编辑模式和 Markdown 源代码编辑模式之间切换。这对于需要直接编辑 Markdown 代码的用户非常有用，同时也保持了对不熟悉 Markdown 的用户的友好性。
        diffSourcePlugin({ viewMode: "rich-text", diffMarkdown: "" }),
        // toolbarPlugin 插件允许我们在编辑器上方添加自定义工具栏按钮。
        // 通过 ConditionalContents 组件，我们可以根据编辑器的状态（例如当前选中的元素类型）来动态显示不同的工具栏内容。
        // 在这个例子中，我们检查当前选中的元素是否是 codeblock，如果是，则显示 ChangeCodeMirrorLanguage 组件，允许用户更改代码块的语言。
        toolbarPlugin({
          toolbarContents: () => (
            <ConditionalContents
              options={[
                {
                  when: (editor) => editor?.editorType === "codeblock",
                  contents: () => <ChangeCodeMirrorLanguage />,
                },
                // 当选中的元素不是 codeblock 时，显示一组常用的工具栏按钮，包括撤销重做、加粗斜体下划线、列表、链接、图片、表格、水平分割线和代码块等功能。这些按钮可以帮助用户快速访问编辑器的各种功能，提高编辑效率。
                {
                  fallback: () => (
                    <>
                      <UndoRedo />
                      <Separator />

                      <BoldItalicUnderlineToggles />
                      <Separator />

                      <ListsToggle />
                      <Separator />

                      <CreateLink />
                      <InsertImage />
                      <Separator />

                      <InsertTable />
                      <InsertThematicBreak />

                      <InsertCodeBlock />
                    </>
                  ),
                },
              ]}
            />
          ),
        }),
      ]}
      {...props}
      ref={editorRef}
    />
  );
};

export default Editor;
