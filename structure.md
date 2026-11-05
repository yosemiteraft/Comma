# .dsu 开发文档架构与管理规范

## 1. 完整目录结构

```
project_root/
├── AGENTS.md
├── docs/                              # possible 原有项目文档
├── .working/
└── .dsu/
    ├── index.md                       # 唯一统一索引for dev
    │
    ├── decisions.md          # 为什么采用或否决某方案？
    ├── dev-spec.md       # high level functional spec for dev on top of baseline
    ├── dev-design.md       # Decisions on design approaches
    ├── build-and-run.md       
    │
    ├── modules/
    │   ├── contracts/
    │   ├── m-{module-name}/
    │   │   ├── spec.md
    │   │   └── impl.md       
    │   └──folder_layout.md  # layout of source code folders
    ├── topics/
    │   └── {topic-name}.md
    │
    ├── ontology/
    │   ├── {name}-sequence.md
    │   └── {name}-pseudocode.md
    │
    ├── tickets/
    │   └── t-{ticket-name}/
    │       ├── t-{ticket-name}.md
    │       └── state.md # for session handover.  most important
    │ 
    └── workers/w-{name}/
        └── w-{name}-id-{session-id}.md
```

.dsu/ is the focus of this instruction.
**.working/** is used for working documents that are allowed to be out of sync with .dsu/

Whenever adding document in .dsu/, update .dsu/index.md

所有开发文档由 `.dsu/index.md` 统一索引。子目录默认不创建另外的 `index.md`，除非用户明确许可。 
其主要职责：

1. **补充根目录的** `**AGENTS.md**`：为 Agent 提供更详细的项目dev文档导航与开发知识入口。
    
2. **跨目录索引**：同时包含 `.dsu/` 内部文件, folder和 `.dsu/` 外部的相关项目folder and documentation。
    
3. **语义定位**：对每个被索引的文档、目录及相关源码提供足够准确的职责与内容描述，让 Agent 根据任务语义找到对应资源with accuracy and less tokens。

**各类文档的职责分工and inter-relationships**:

| 文档                                             | 核心问题                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.dsu/index.md`                                | 相关开发知识在哪里？Efficient token usage.                                                                                                                                                                                                                                              |
| dev-spec.md                                    | The whole development要实现什么new功能 and how they work within existing base？                                                                                                                                                                                                       |
| dev-design.md`                                 | Decide design approaches, division of modules and how they work together to fulfill the spec.                                                                                                                                                                                 |
| `modules/m-{module-name}/spec.md`              | Module要实现什么功能？Define its interface with other modules.  Shall conform to dev-spec.md and dev-design.md.                                                                                                                                                                       |
| `modules/m-{module-name}/impl.md`              | 如何组织具体实施implementation？To modify folders, files, functions, interfaces, etc to implement functionality.  Shall conform to this dev-spec.md, dev-design.md, and `m-{module-name}/spec.md`.                                                                                     |
| `modules/contracts`                            | Define contracts between modules.  This is more cross-module view than contracts within each module directory. Shall conform to dev-spec.md and dev-design.md.                                                                                                                |
| `modules/folder_layout.md`                     | Layout of new source code folders. If changed existing source code base, give the link of the changed files.                                                                                                                                                                  |
| `ontology/*-sequence.md`                       | key scenario软件对象与关系怎样随动作变化？communicate with human                                                                                                                                                                                                                             |
| `ontology/*-pseudocode.md`                     | Key scenario哪些文件和函数按什么顺序调用，最终使用哪个真实 API？communicate with human                                                                                                                                                                                                                |
| `decisions.md`                                 | 为什么采用或否决某方案？                                                                                                                                                                                                                                                                  |
| `tickets/t-{ticket-name}/t-{ticket-name}.md`   | 这个 Ticket 要完成什么objectives demanded by human？                                                                                                                                                                                                                                  |
| `tickets/t-{ticket-name}/state.md`             | 任务做到了哪里，下一位 Agent 如何接手？Must contain adequate instructions and links for new agent to continue the ticket task.<br>Typically refer to current works in dev-spec.md, dev-design.md,  `m-{module-name}/spec.md`, `m-{module-name}/impl.md`, topics/review-xxx.md, or other docs. |
| `workers/w-{name}/w-{name}-id-{session-id}.md` | 哪个 Worker Session 正在执行哪个 Ticket？多个 Workers 在不同 Session 中执行一个 Ticket                                                                                                                                                                                                           |
| topics/                                        | Documents that help produce the spec, design approach, and implementation.                                                                                                                                                                                                    |

**When agent is under a specific ticket context, and receive prompt "update-doc"**:
Agent shall incorporate latest agent context, make sure all documents under .dsu/ shall be consistent with each others.  .dsu/ ticket state.md, index.md are the most important for new agent to start work.

**When agent is under a specific ticket context, and receive prompt "update-all"**:
Besides doing update-doc action, agent shall use git diff to use all delta of source (not binary) files not check in yet as facts to make .dsu/ ticket state.md, index.md, module impl.md, and docs consistent.  Especially in ticket state.md, might need to reference those files and lines that change for the ticket. 

## 2. ontology/：

### 2.1 ontology/xxx-sequence.md
Follow /Users/cosmic/.c/principle/Sequence rule.md.  用户might要求Agent 以本体序列快照Snapshot的形式表达certain matters。

### 2.2 ontology/xxx-pseudocode.md
**Pseudocode 文档**进一步把关键实施路径落实到具体函数调用sequence.

| 字段       | 内容                                                                                    |
| -------- | ------------------------------------------------------------------------------------- |
| Step     | T10、T20 等序列编号                                                                         |
| File     | 源码文件路径                                                                                |
| Function | 实际函数名称                                                                                |
| Call     | 调用的下一个函数或 API                                                                         |
| Input    | 关键输入参数及必要状态                                                                           |
| Output   | 返回值、错误或状态更新                                                                           |
| Evidence | 函数定义、API 文档或源码证据.  Must not fake unverified API.  Shall look up source or online doc. |
| Snapshot | At each critical step, write the snapshot of key objects after that point of time.    |
Key API calls are how software component eventually actualize the key impacts.  In the sequence, 能够明确找到最终需要使用的现有 API，并确认该 API 的真实名称、参数契约、返回值与来源。

- **任务交接以 Ticket 的** `t-{ticket-name}/state.md` **为主要依据，不依赖恢复旧 Worker 的完整对话历史。**



