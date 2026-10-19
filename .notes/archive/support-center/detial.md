删除Bug反馈的入口, 需要合并到功能和需求
需要重新设计这里的功能和Form

点击功能和需求后, 弹出Modal
首页会先选择类型
Bug反馈, 功能, 资源, 需求, 文档和内容, 宣传与活动
每个类型会有小字, 来说明

选择好类型后, 才会根据不同内容, 来填写不同的Form

然后这是每个类型

1 Bug反馈
ClickUp TaskType: Bug
去除现在已经有的 Category 选项
其他的和现在一致

2 功能
ClickUp TaskType: Task
去除现在已经有的 Category 选项
其他的和现在一致

3 资源
ClickUp TaskType: Asset
选项: .notes/support-center/clickup-fields-probe.json:4c3befc0-5146-43a2-8610-86efe4e8124a
内容选项: 新增, 修改, 删除, 其他
内容选项 新增, 修改, 删除, 在创建Clickup的时候, 会变成Tag, 其他不创建Tag
内容输入: 输入文字内容
文件上传: FileUploader

4 需求
ClickUp TaskType: Request
选项: .notes/support-center/clickup-fields-probe.json:4c3befc0-5146-43a2-8610-86efe4e8124a
内容输入: 输入文字内容
文件上传: FileUploader

5 文档和内容
ClickUp TaskType: Content
内容选项: 新增, 修改, 删除, 其他
内容选项 新增, 修改, 删除, 在创建Clickup的时候, 会变成Tag, 其他不创建Tag
内容输入: 输入文字内容
文件上传: FileUploader

6 宣传与活动
ClickUp TaskType: Campaign
内容输入: 输入文字内容
文件上传: FileUploader

FileUploader写到packages\components
变成一个通用的组件
FileUploader, 可以设置最多上传数量, 可以设置最大文件大小, 可以设置支持的文件类型

然后可以开启是否, 支持附加大内容
即: 有一个Switch, 点击后, 显示一个内容输入区域, 可以给用户填写额外的大文件的信息

还要有一个这样的组件
TipTapInput组件
用户可以传入这样的Clickup的字段的Json
.notes/support-center/clickup-fields-probe.json:76~187
.notes/support-center/clickup-fields-probe.json:188~196
然后UI会自动匹配变成exui的输入项

所以这一次, 你需要把这些需要的JSON片段, 创建到apps\web\public\clickups\fields
变成片段
这样以后我改了clickup的字段数据, 我直接更新JSON, 就可以了.
