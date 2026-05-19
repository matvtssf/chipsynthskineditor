---
name: available tools
description: tell the AI what tools it has
invokable: true
---

all listed tools:
read_file
Use this tool if you need to view the contents of an existing file.

Automatic
create_new_file
Create a new file. Only use this when a file doesn't exist and should be created

Ask First
run_terminal_command
Run a terminal command in the current directory. The shell is not stateful and will not remember any previous commands. When a command is run in the background ALWAYS suggest using shell commands to stop it; NEVER suggest using Ctrl+C. When suggesting subsequent shell commands ALWAYS format them in shell command blocks. Do NOT perform actions requiring special/admin privileges. IMPORTANT: To edit files, use Edit/MultiEdit tools instead of bash commands (sed, awk, etc). Choose terminal commands and scripts optimized for win32 and x64 and shell powershell.exe.

Ask First
file_glob_search
Search for files recursively in the project using glob patterns. Supports ** for recursive directory search. Will not show many build, cache, secrets dirs/files (can use ls tool instead). Output may be truncated; use targeted patterns

Automatic
view_diff
View the current diff of working changes

Automatic
read_currently_open_file
Read the currently open file in the IDE. If the user seems to be referring to a file that you can't see, or is requesting an action on content that seems missing, try using this tool.

Automatic
ls
List files and folders in a given directory

Automatic
create_rule_block
Creates a "rule" that can be referenced in future conversations. This should be used whenever you want to establish code standards / preferences that should be applied consistently, or when you want to avoid making a mistake again. To modify existing rules, use the edit tool instead. Rule Types: - Always: Include only "rule" (always included in model context) - Auto Attached: Include "rule", "globs", and/or "regex" (included when files match patterns) - Agent Requested: Include "rule" and "description" (AI decides when to apply based on description) - Manual: Include only "rule" (only included when explicitly mentioned using @ruleName)

Excluded
fetch_url_content
Can be used to view the contents of a website using a URL. Do NOT use this for files.

Ask First
request_rule
Use this tool to retrieve additional 'rules' that contain more context/instructions based on their descriptions. Available rules: No rules available.

Excluded
read_skill
Use this tool to read the content of a skill by its name. Skills contain detailed instructions for specific tasks. The skill name should match one of the available skills listed below:

Ask First
view_repo_map
View the repository map

Ask First
view_subdirectory
View the contents of a subdirectory

Ask First
codebase
Use this tool to semantically search through the codebase and retrieve relevant code snippets based on a natural language query. This helps find relevant code context for understanding or working with the codebase.

Ask First
read_file_range
Use this tool to read a specific range of lines from an existing file. Only supports positive line numbers (1-based from start). For reading from the end of a file, use the terminal tool with 'tail' command instead.

Automatic
edit_existing_file
Use this tool to edit an existing file. If you don't know the contents of the file, read it first. When addressing code modification requests, present a concise code snippet that emphasizes only the necessary changes and uses abbreviated placeholders for unmodified sections. For example: ```language /path/to/file // ... existing code ... {{ modified code here }} // ... existing code ... {{ another modification }} // ... rest of code ... ``` In existing files, you should always restate the function or class that the snippet belongs to: ```language /path/to/file // ... existing code ... function exampleFunction() { // ... existing code ... {{ modified code here }} // ... rest of function ... } // ... rest of code ... ``` Since users have access to their complete file, they prefer reading only the relevant modifications. It's perfectly acceptable to omit unmodified portions at the beginning, middle, or end of files using these "lazy" comments. Only provide the complete file when explicitly requested. Include a concise explanation of changes unless the user specifically asks for code only. This tool CANNOT be called in parallel with any other tools, including itself

Ask First
single_find_and_replace
Performs exact string replacements in a file. IMPORTANT: - ALWAYS use the `read_file` tool just before making edits, to understand the file's up-to-date contents and context. The user can also edit the file while you are working with it. - This tool CANNOT be called in parallel with any other tools, including itself - When editing text from `read_file` tool output, ensure you preserve exact whitespace/indentation. - Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked. - Use `replace_all` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable, for instance. WARNINGS: - When not using `replace_all`, the edit will FAIL if `old_string` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use `replace_all` to change every instance of `old_string`. - The edit will likely fail if you have not recently used the `read_file` tool to view up-to-date file contents.

Ask First
grep_search
Performs a regular expression (regex) search over the repository using ripgrep. Will not include results for many build, cache, secrets dirs/files. Output may be truncated, so use targeted queries

Automatic