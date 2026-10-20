export interface paths {
    "/api/account/grants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查看本人第三方授权
         * @description 我授权过的应用列表
         */
        get: operations["accountGrants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/grants/{client_id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤销授权及关联会话
         * @description 撤销对某应用的授权（该应用名下我的 token 立即失效）
         */
        post: operations["accountRevokeGrant"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 登录并创建独立会话
         * @description 图片验证码五分钟有效且一次性；此路径必填 captcha。
         */
        post: operations["accountLogin"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤销当前会话
         * @description 登出（撤销当前会话, token 立即失效）
         */
        post: operations["accountLogout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 当前登录用户
         * @description 当前登录用户信息
         */
        get: operations["accountMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 修改密码并下线其他设备
         * @description 修改密码（成功后下线其他全部设备）
         */
        post: operations["accountChangePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 注册并自动登录
         * @description 若邮箱已发送验证码则必须匹配 code；未发送时当前实现放行。密码至少六字节。
         */
        post: operations["accountRegister"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/send-email-code": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 发送注册邮箱验证码
         * @description 同邮箱冷却六十秒，验证码十分钟有效。邮件失败且 debug 开启时返回 debug_code。
         */
        post: operations["accountSendEmailCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 最近一百条登录会话
         * @description 我的登录会话列表（多设备/多平台）
         */
        get: operations["accountSessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/sessions/revoke-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤销除当前以外所有会话
         * @description 下线除当前会话外的全部设备
         */
        post: operations["accountRevokeOtherSessions"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/sessions/{sid}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤销本人指定会话
         * @description 撤销指定会话（下线某设备）
         */
        post: operations["accountRevokeSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/bindings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 全局绑定码列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminBindingIndex"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/bindings/{id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 吊销绑定码
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。已吊销或不存在返回400；吊销后清缓存，插件下次心跳立即感知。
         */
        post: operations["adminBindingRevoke"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/clients": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 第三方应用列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminClientIndex"];
        put?: never;
        /**
         * 注册第三方应用
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。密钥明文仅本次返回。plugin 类应用必须指定 active 空间；third_party 应用空间置空。
         */
        post: operations["adminClientCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/clients/{id}/secret-reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 重置应用密钥
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。撤销该应用的全部会话；新密钥明文仅本次返回。
         */
        post: operations["adminClientSecretReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/clients/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 更新应用状态
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。停用时撤销该应用的全部会话。
         */
        post: operations["adminClientStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 平台概览
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminDashboardIndex"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/doc-categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 平台文档分类
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminDocCategories"];
        put?: never;
        /**
         * 创建平台文档分类
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        post: operations["adminDocCategoryCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/doc-categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 删除平台文档分类
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。删除后其下文档移至未分类；分类不存在也返回成功。
         */
        delete: operations["adminDocCategoryDelete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/docs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 平台文档列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminDocIndex"];
        put?: never;
        /**
         * 创建平台文档
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。owner_type 固定为 platform。servers/tags 可见性必须至少包含一个有效空间/标签。
         */
        post: operations["adminDocCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/docs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 更新平台文档
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。只更新提供的字段；有字段变动时版本号加1；可见性列表先过滤无效 ID，再校验非空。
         */
        put: operations["adminDocUpdate"];
        post?: never;
        /**
         * 删除平台文档
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。限定 platform 归属；文档不存在也返回成功。
         */
        delete: operations["adminDocDelete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/docs/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 发布或撤下平台文档
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        post: operations["adminDocStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 反馈工单列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminFeedbackIndex"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/feedback/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 反馈工单详情
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminFeedbackDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/feedback/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 处理反馈工单
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。管理状态允许前进和回退；可同时更新管理员备注。
         */
        post: operations["adminFeedbackStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 审计日志列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminLogIndex"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 通知批次列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminNotificationIndex"];
        put?: never;
        /**
         * 发送站内通知
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。community 广播给全部用户，personal 发给指定邮箱用户；为每位接收者保存独立回执。
         */
        post: operations["adminNotificationCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/notifications/{batch}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 删除通知批次
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。物理删除整批通知；批次不存在返回400。
         */
        delete: operations["adminNotificationDelete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/notifications/{batch}/expire": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤回通知批次
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。按批置过期；不存在或全部已过期返回400。
         */
        post: operations["adminNotificationExpire"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/plugin-options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 在线插件选项
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminPluginOptions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/plugins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 插件目录列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminPluginIndex"];
        put?: never;
        /**
         * 创建插件草稿
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        post: operations["adminPluginCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/plugins/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 更新插件资料
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        put: operations["adminPluginUpdate"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/plugins/{id}/features": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 插件功能点列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminPluginFeatures"];
        put?: never;
        /**
         * 添加插件功能点
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        post: operations["adminPluginFeatureCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/plugins/{id}/features/{fid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 更新插件功能点
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。已有绑定码时仅允许修改名称和默认开关，禁止改变 feature_key。
         */
        put: operations["adminPluginFeatureUpdate"];
        post?: never;
        /**
         * 删除插件功能点
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。插件已有绑定码时禁止删除；否则不存在的功能点也返回成功。
         */
        delete: operations["adminPluginFeatureDelete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/plugins/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 更新插件上下架状态
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。清理持有该插件的全部空间缓存；offline 后全部绑定码校验拒绝。
         */
        post: operations["adminPluginStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/server-options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 可用空间选项
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminServerOptions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/servers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 空间列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminServerIndex"];
        put?: never;
        /**
         * 创建空间
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。创建 active 空间，同时将指定 Owner 加入 owner 成员关系。
         */
        post: operations["adminServerCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/servers/{sid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 空间详情
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminServerDetail"];
        /**
         * 更新空间资料
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        put: operations["adminServerUpdate"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/servers/{sid}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 更新空间状态
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。清空空间许可与权限缓存；暂停后其全部绑定码授权失效，恢复后生效。
         */
        post: operations["adminServerStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/sso-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 活跃设备及SSO请求列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。实时读取 Redis 短期请求，按 created_ago 降序，不分页。
         */
        get: operations["adminSsoIndex"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/sso-requests/{deviceCode}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤销设备或SSO请求
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。删除请求与反向索引；不存在或已过期返回404。
         */
        post: operations["adminSsoRevoke"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 用户标签列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminTagIndex"];
        put?: never;
        /**
         * 创建用户标签
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        post: operations["adminTagCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 删除用户标签
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。删除标签并使其文档可见性引用失效。不存在的标签也返回成功。
         */
        delete: operations["adminTagDelete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 用户列表
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminUserIndex"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 用户详情
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        get: operations["adminUserDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{id}/ban": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 封禁或解封用户
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。不能封禁自己；操作超级管理员目标仅限超级管理员。封禁立即撤销该用户全部会话；拒绝分支返回400。
         */
        post: operations["adminUserBan"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{id}/platform-role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 设置平台角色
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。授予 superadmin 仅超级管理员可操作，拒绝分支返回400；空角色清除平台权限。
         */
        post: operations["adminUserPlatformRole"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/users/{id}/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 替换用户标签
         * @description 需要有效登录会话及平台角色 superadmin 或 ops。平台角色不足按当前实现返回400；登录态失效401，封禁或全局限流403。
         */
        post: operations["adminTagSetUserTags"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/captcha/challenges": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 创建一次性图片验证码
         * @description 五分钟有效；返回 PNG base64 字节，无 data: 前缀。
         */
        post: operations["authCaptchaChallenge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/invitations/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 检查邀请注册资格
         * @description 资格检查（未注册邮箱即符合邀请条件）
         */
        post: operations["authInvitationCheck"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/invitations/code": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 发送邀请码
         * @description 验证码十分钟有效，发送冷却六十秒；429 响应带 Retry-After 秒数。
         */
        post: operations["authInvitationCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/invitations/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 消费完成令牌并注册账号
         * @description 成功后不自动登录；完成令牌过期或已消费返回 401。
         */
        post: operations["authInvitationComplete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/invitations/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 一次性消费邀请码并签发完成令牌
         * @description 验证码一次性消费后颁发十分钟一次性完成令牌；连续失败锁定时 429 带 Retry-After 秒数。
         */
        post: operations["authInvitationVerify"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 登录并创建独立会话
         * @description captcha 可选；提供后进行一次性校验。
         */
        post: operations["authLogin"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 撤销当前会话 */
        post: operations["authLogout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 当前登录用户 */
        get: operations["authMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * 更新昵称、QQ 或清除头像
         * @description 更新当前用户资料（用户侧网站对接, PATCH /api/auth/me）
         *     支持: nickname(显示名) / qq(可 null 清空) / avatar(null 清除头像恢复默认)
         *     fivemId 不允许在此设置——游戏身份必须走绑定码/SSO 绑定流程
         */
        patch: operations["authUpdateProfile"];
        trace?: never;
    };
    "/api/auth/me/avatar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 上传头像并转换为 WebP
         * @description 上传头像（用户侧网站对接, base64 图片统一转 WebP 存储）
         */
        post: operations["authUploadAvatar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sso/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 使用当前会话确认 SSO 授权
         * @description 使用 CheckLogin 注入的当前用户身份确认设备请求。请求不存在或过期为 404；已完成、并发处理或应用停用为 409。插件继续轮询 device/token 获取 OAuth 令牌。
         */
        post: operations["confirmInternalSsoRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sso/inspect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 查询用户网站 SSO 请求状态
         * @description 免登录；检查 device/init 返回的 sso_request_id。不存在、格式不匹配或过期均返回 404；时间为 Unix 毫秒。
         */
        post: operations["inspectInternalSsoRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sso/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 使用邮箱密码完成 SSO 授权
         * @description 免登录；可选图片验证码传入后会校验。凭据错误为 400，用户禁用为 403，SSO 请求不存在或过期为 404，已完成、并发处理或应用停用为 409。本动作只确认设备请求，不签发浏览器本地会话；插件继续轮询 device/token。
         */
        post: operations["loginInternalSsoRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/avatars/{avatarId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取 WebP 头像
         * @description 读取头像图片（公开, /api/avatars/{avatarId}）
         */
        get: operations["accountAvatarImage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/docs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 可浏览文档列表
         * @description 免登录，可选 sessionAuth Bearer；只有 JWT 和会话均有效且用户匹配才识别身份，无效令牌按匿名处理。public 任何人可见；ops/superadmin 可查看全部已发布文档；login 需有效登录，servers 需指定空间 active 成员，tags 需标签交集；空间 members 需 active 成员，roles 对 owner/admin 恒可见、普通成员需匹配 visible_roles。只选已发布文档，先按 ID 倒序取前 100 条再进行可见性过滤，因此结果可能少于 100；不返回正文。
         */
        get: operations["contentDocumentList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/docs/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 浏览文档正文
         * @description 免登录，可选 sessionAuth Bearer；只有 JWT 和会话均有效且用户匹配才识别身份，无效令牌按匿名处理。public 任何人可见；ops/superadmin 可查看全部已发布文档；login 需有效登录，servers 需指定空间 active 成员，tags 需标签交集；空间 members 需 active 成员，roles 对 owner/admin 恒可见、普通成员需匹配 visible_roles。查不到或不可见均按当前实现返回 400“文档不存在”，以相同响应避免泄露存在性；成功返回完整模型。
         */
        get: operations["contentDocumentDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 数据库与 Redis 健康检查
         * @description 免登录，仍受首次安装保护。执行一次用户表查询和 Redis ping；任一连接异常由 ApiHandler 返回 HTTP 500。
         */
        get: operations["systemHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/installation/install": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 首次部署初始化
         * @description 免登录。必须携带 X-Setup-Request: 1；如提供 Origin，其主机与端口必须等于请求 Host（否则 403）。已安装、本机安装锁竞争、数据库 advisory lock 竞争、已有 app_ 表但未 force 均返回 409。环境不就绪、输入不合法、Redis 读写失败、数据库连接或建表失败返回 400。force=true 必须同时给出 force_confirmation=重置数据库，在事务内重建 public 下 app_ 业务表；外部依赖保护仍生效。创建首个 superadmin，写入数据库/Redis 配置及随机 JWT 密钥，保留其他环境项，不回传密码。
         */
        post: operations["systemInstallationInstall"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/installation/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 初始化状态和环境检查
         * @description 免登录，跳过首次安装保护。已安装仅返回 installed=true；否则检查 PHP/扩展、目录及配置可写和数据库脚本可读。检测已有 superadmin 时可补写 install.lock；不返回配置凭据。
         */
        get: operations["systemInstallationStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notification-preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取通知偏好 */
        get: operations["notificationPreferences"];
        /**
         * 整体替换可选类别偏好
         * @description announcement 与 personal_update 均须传布尔值；service_notice 不可关闭。serverTime 使用秒。
         */
        put: operations["notificationUpdatePreferences"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 通知列表与签名游标分页
         * @description 通知列表（keyset 分页, view=unread|history）
         */
        get: operations["notificationList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/clear-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 按快照清理通知
         * @description 令牌绑定用户与用途；requestId 的幂等结果保留十分钟。
         */
        post: operations["notificationClearAll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/clear-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 生成十分钟清理快照
         * @description 快照绑定用户、批次、上界及数量，十分钟有效。
         */
        post: operations["notificationClearPreview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 按令牌上界全部已读
         * @description 令牌绑定用户与用途；requestId 的幂等结果保留十分钟。
         */
        post: operations["notificationReadAll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 未读摘要
         * @description 未读摘要（铃铛轮询）
         */
        get: operations["notificationSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/{notificationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 通知详情（不自动已读）
         * @description 通知详情（读详情不改变已读状态）
         */
        get: operations["notificationDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/{notificationId}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * 更新已读状态与修订号
         * @description 单条已读/未读（乐观锁 409）
         */
        patch: operations["notificationSetState"];
        trace?: never;
    };
    "/api/oauth/authorize-info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询待授权应用信息
         * @description 需要用户会话；client_id 与 redirect_uri 虽未做独立必填检查，但缺失时应用或回调校验失败，返回 400。
         */
        get: operations["getInternalOAuthAuthorizationInfo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/oauth/authorize/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 确认网页授权并返回回调地址
         * @description 需要用户会话与 active third_party 应用；校验回调白名单，合并 scope 授权关系并生成 300 秒一次性授权码。响应为包含 code/state 的 redirect 字符串，不是 HTTP 302。
         */
        post: operations["confirmInternalOAuthAuthorization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/oauth/device/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 确认六位设备用户码
         * @description 需要用户会话；校验用户码和应用状态，创建授权关系并原子确认设备。无效、过期或已使用用户码返回 400，并发状态变化返回 409。
         */
        post: operations["verifyInternalOAuthDevice"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/mine": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我管理的空间
         * @description 需登录；仅返回当前用户 active owner/admin 成员关系对应的 active 空间。不经过 ServerMember。
         */
        get: operations["serverMine"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 空间概览
         * @description 任意 active 成员可查看；统计 active 成员、全部绑定码及本空间产生的游戏标识。当前返回完整空间模型（含 note）。
         */
        get: operations["serverOverview"];
        /**
         * 更新空间设置
         * @description 需要当前空间 active 成员身份及 owner 角色；权限或空间不存在按当前实现返回 400。仅处理提供的 name/description/contact_qq/logo，未提供字段保持原值。
         */
        put: operations["serverSettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/bindings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 绑定码与在线插件选项
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。绑定码按 ID 倒序；完整序列化包含 code、server_key_hash、features 和心跳字段。plugin 仅选取 id/slug/name/status；plugin_options 仅含 online 插件并按名称排序。
         */
        get: operations["serverBindingList"];
        put?: never;
        /**
         * 生成插件绑定码
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。空间须 active，插件须 online，一空间一插件仅一个绑定码；重复时须重置。
         */
        post: operations["serverBindingCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/bindings/{id}/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 停用插件绑定码
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅当前空间绑定，状态改为 disabled 并清理权限缓存；当前实现不额外检查空间或插件状态。
         */
        post: operations["serverBindingDisable"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/bindings/{id}/enable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 启用插件绑定码
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅当前空间绑定，状态改为 active 并清理权限缓存；当前实现不额外检查空间或插件状态。
         */
        post: operations["serverBindingEnable"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/bindings/{id}/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 重置插件绑定码
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅当前空间绑定；旧码立即失效，清空 server_key_hash 并设 active，清理权限缓存。
         */
        post: operations["serverBindingReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/clients": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 本空间插件应用
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅 type=plugin 且归属当前空间的应用，按 ID 倒序；没有 link 时 link_status 默认 active。只返回选定字段，不返回 client_secret_hash。
         */
        get: operations["serverClientList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/clients/connect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 恢复应用授权
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。应用必须归属本空间；已有 link 时仅恢复 active，不清空 disconnected_time；不恢复已撤销会话。
         */
        post: operations["serverClientConnect"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/clients/disconnect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 断开应用授权
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。应用必须归属本空间；创建/更新 disconnected 关系，并立即撤销该应用名下所有本空间成员的 active 会话（不限成员状态）。
         */
        post: operations["serverClientDisconnect"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/doc-categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 空间文档分类
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅本空间 owner_type=server 分类，按 sort、ID 升序。
         */
        get: operations["serverDocCategoryList"];
        put?: never;
        /**
         * 创建空间文档分类
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。分类名 trim 后必填；sort 默认 0。
         */
        post: operations["serverDocCategoryCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/doc-categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 删除空间文档分类
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅删除本空间分类；不存在也成功，数据库外键将关联文档 category_id 置空。
         */
        delete: operations["serverDocCategoryDelete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/docs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 本空间文档列表
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅 owner_type=server 且 server_id 为当前空间；按 ID 倒序，含草稿和完整正文。keyword 匹配 title 或 slug。
         */
        get: operations["serverDocList"];
        put?: never;
        /**
         * 创建空间文档
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。标题必填；visibility 默认为 members。slug 无效或冲突自动生成；roles 至少一个有效角色。
         */
        post: operations["serverDocCreate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/docs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 编辑空间文档
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅查本空间 owner_type=server 文档，不存在返回 400；有效编辑 version+1，无有效编辑返回原 version；发布状态单独修改。
         */
        put: operations["serverDocUpdate"];
        post?: never;
        /**
         * 删除空间文档
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅删除本空间 owner_type=server 文档；目标不存在也返回成功。
         */
        delete: operations["serverDocDelete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/docs/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 修改文档发布状态
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅本空间文档；status 必须为 draft/published；不增加版本号。
         */
        post: operations["serverDocStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/idents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 游戏绑定记录
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅返回 bound_server_id 为当前空间的记录，按 ID 倒序；列表返回完整 ident_value 与精简 user 关系。
         */
        get: operations["serverIdentList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/idents/bind": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 使用游戏 ticket 绑定用户
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。ticket 校验归属空间并一次性消费；目标用户须存在，游戏标识全局唯一。已有同用户绑定直接返回空 data 和提示；其他用户绑定或空间 banned 拒绝。无成员关系则自动加入，left 成员重新激活。新绑定仅回显 ident_tail 与用户 ID/昵称。
         */
        post: operations["serverIdentBind"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/idents/{id}/unbind": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 解绑游戏标识
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。仅允许删除在本空间产生的标识记录；不存在或其他空间返回 400。
         */
        post: operations["serverIdentUnbind"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/member-perms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 成员全部插件权限
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。目标须为本空间 active 成员；列出全部绑定插件，按绑定 ID 倒序。无覆盖时 allowed=true、features=null；无插件时 list=[] 且 member 不含 avatar。
         */
        get: operations["serverMemberPermissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 成员列表
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。包含 active/banned/left 全部成员，按 ID 倒序，user 仅选取 id/email/username/avatar/qq。
         */
        get: operations["serverMemberList"];
        put?: never;
        /**
         * 添加或重新激活成员
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。keyword 精确匹配邮箱或 QQ；拒绝平台封禁用户、现有 owner 或 banned 成员；仅 owner 可授予 admin。已离开成员重新激活。
         */
        post: operations["serverMemberAdd"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/members/{uid}/ban": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 禁用成员
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。状态改为 banned，权限判定按非成员处理。不能操作自己或 owner，admin 只能操作 member。
         */
        post: operations["serverMemberBan"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/members/{uid}/remove": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 移除成员
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。状态改为 left。不能操作自己或 owner，admin 只能操作 member。
         */
        post: operations["serverMemberRemove"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/members/{uid}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 调整成员角色
         * @description 需要当前空间 active 成员身份及 owner 角色；权限或空间不存在按当前实现返回 400。不能调整 owner；目标用户按当前空间查找。
         */
        post: operations["serverMemberRole"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/members/{uid}/unban": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 解除成员禁用
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。目标必须为 banned 且非 owner。当前动作没有禁止操作自己/admin 的额外检查。
         */
        post: operations["serverMemberUnban"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/plugin-perms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 插件成员权限矩阵
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。插件必须已在本空间生成绑定码；仅 active 成员，按 role_key 倒序。无覆盖时 allowed=true、features=null；返回绑定码选定字段与完整功能点。
         */
        get: operations["serverPermissionMatrix"];
        put?: never;
        /**
         * 保存成员插件权限
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。插件须已绑定且目标为 active 成员；features 仅保留已知功能键并转换为 bool。保存后清缓存，插件下次同步生效。
         */
        post: operations["serverPermissionSave"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/plugin-perms/push": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 下发插件权限
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。清缓存并增加权限版本；无可下发绑定返回 400。EXCore >=1.1 可检测版本并拉取，旧版等待心跳。
         */
        post: operations["serverPermissionPush"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/server/{sid}/plugin-perms/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 恢复成员插件默认权限
         * @description 需要当前空间 active 成员身份及 owner/admin 权限；空间角色/归属/业务检查失败按当前实现返回 400。插件须已绑定；删除目标用户对该插件的覆盖并清缓存，未额外校验目标成员存在。
         */
        post: operations["serverPermissionReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/storage/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 公开下载本地文件
         * @description 公开读取（octet-stream + attachment, 禁嗅探）
         */
        get: operations["storageReadFile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/storage/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 上传本地文件
         * @description 服务端中转上传（multipart: data 文件 + key/medium/contentType 文本字段）
         */
        post: operations["storageUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/storage/uploads/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * COS 上传确认（未启用）
         * @description 当前部署始终返回 503 与 {msg} 错误体；不解析请求字段。
         */
        post: operations["storageComplete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/storage/uploads/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 本地文件上传计划
         * @description file 介质返回二十 MiB 上限；cos 未启用，返回 503。
         */
        post: operations["storagePrepare"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/support/feedback/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 反馈表单选项及大小上限
         * @description 表单选项（本部署全类型可用, 无动态字段）
         */
        get: operations["feedbackOptions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/support/feedback/submissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 创建或恢复反馈收取快照
         * @description 新建返回 201；同一恢复键重放返回 200。
         */
        post: operations["feedbackPrepare"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/support/feedback/submissions/lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按恢复键查本人反馈
         * @description 按恢复键查反馈
         */
        get: operations["feedbackLookup"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/support/feedback/submissions/{submissionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 本人反馈详情
         * @description 反馈详情
         */
        get: operations["feedbackDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/support/feedback/submissions/{submissionId}/advance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 按修订号推进反馈
         * @description continue 要求全部附件到位并完成反馈；retry 返回当前快照；expectedRevision 不匹配返回 409。
         */
        post: operations["feedbackAdvance"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/support/feedback/submissions/{submissionId}/attachments/{attachmentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 上传声明附件
         * @description 必须处于 receiving；同一已上传附件返回原快照。新上传字节大小与 SHA-256 必须匹配声明；成功递增 revision。
         */
        put: operations["feedbackUploadAttachment"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AccountAdminLoginRequest: {
            captcha: components["schemas"]["AccountCaptchaAnswer"];
            /** Format: email */
            email: string;
            /** Format: password */
            password: string;
        };
        AccountAvatarRequest: {
            /**
             * Format: byte
             * @description 无 data: 前缀的原始图片 base64 字节；解码后最多 2MiB
             */
            imageBase64: string;
            /** @enum {string} */
            mediaType: "image/png" | "image/jpeg" | "image/webp";
        };
        AccountCaptchaAnswer: {
            answer: string;
            /** @description 实际 PHP 请求与响应结构。 */
            challengeId: string;
        };
        AccountCaptchaData: {
            challengeId: string;
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            expiresAt: number;
            /**
             * Format: byte
             * @description PNG 图片字节 base64，无 data: 前缀
             */
            imageBase64: string;
        };
        AccountCaptchaResponse: {
            data: components["schemas"]["AccountCaptchaData"];
            msg: string;
        };
        AccountEmailCodeResponse: {
            data: string[] | {
                debug_code: string;
            };
            msg: string;
        };
        AccountEmailRequest: {
            /** Format: email */
            email: string;
        };
        AccountEmptyResponse: {
            data: string[];
            msg: string;
        };
        AccountGrant: {
            app_name: string;
            app_status: string | null;
            app_type: string | null;
            client_id: string;
            granted_time: string | null;
            revoked_time: string | null;
            scopes: string[];
            status: string;
        };
        AccountGrantsData: {
            list: components["schemas"]["AccountGrant"][];
        };
        AccountGrantsResponse: {
            data: components["schemas"]["AccountGrantsData"];
            msg: string;
        };
        AccountInvitationCheckData: {
            /** Format: email */
            email: string;
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            resendAvailableAt: number;
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            serverTime: number;
            /** @enum {string} */
            status: "eligible";
        };
        AccountInvitationCheckResponse: {
            data: components["schemas"]["AccountInvitationCheckData"];
            msg: string;
        };
        AccountInvitationCodeData: {
            /** @description 邮件发送失败且 debug 开启时存在 */
            debug_code?: string;
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            resendAvailableAt: number;
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            serverTime: number;
            /** @enum {string} */
            status: "accepted";
        };
        AccountInvitationCodeResponse: {
            data: components["schemas"]["AccountInvitationCodeData"];
            msg: string;
        };
        AccountInvitationCompleteData: {
            email: string;
            /** @enum {string} */
            status: "registered";
        };
        AccountInvitationCompleteRequest: {
            /** @description 十分钟一次性完成令牌 */
            completionToken: string;
            nickname: string;
            /** Format: password */
            password: string;
        };
        AccountInvitationCompleteResponse: {
            data: components["schemas"]["AccountInvitationCompleteData"];
            msg: string;
        };
        AccountInvitationVerifyData: {
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            completionExpiresAt: number;
            completionToken: string;
            email: string;
            nickname: string;
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            serverTime: number;
            /** @enum {string} */
            status: "verified";
        };
        AccountInvitationVerifyRequest: {
            captcha?: components["schemas"]["AccountCaptchaAnswer"];
            code: string;
            /** Format: email */
            email: string;
        };
        AccountInvitationVerifyResponse: {
            data: components["schemas"]["AccountInvitationVerifyData"];
            msg: string;
        };
        AccountLoginData: {
            /** @description 有效期秒数 */
            expires_in: number;
            token: string;
            user: components["schemas"]["AccountLoginUser"];
        };
        AccountLoginRequest: {
            captcha?: components["schemas"]["AccountCaptchaAnswer"];
            /** Format: email */
            email: string;
            /** Format: password */
            password: string;
        };
        AccountLoginResponse: {
            data: components["schemas"]["AccountLoginData"];
            msg: string;
        };
        AccountLoginUser: {
            avatar: string | null;
            /** Format: email */
            email: string;
            id: number;
            /** @description 注册后当前模型未刷新数据库默认值，此分支可为 null；登录从数据库读取后为字符串 */
            platform_role: string | null;
            username: string;
        };
        AccountMeData: {
            avatar: string | null;
            /** Format: email */
            email: string;
            id: number;
            /** @description 数据库时间 Y-m-d H:i:s */
            last_login_time: string | null;
            platform_role: string;
            qq: string | null;
            username: string;
        };
        AccountMeResponse: {
            data: components["schemas"]["AccountMeData"];
            msg: string;
        };
        AccountPasswordRequest: {
            /** Format: password */
            new_password: string;
            /** Format: password */
            old_password: string;
        };
        AccountProfileRequest: {
            /** @description 仅 null 清除头像；其他值忽略 */
            avatar?: string | null;
            /** @description 仅允许 null；其他值返回 400 */
            fivemId?: string | null;
            nickname?: string;
            qq?: string | null;
        };
        AccountRegisterRequest: {
            code?: string;
            /** Format: email */
            email: string;
            /** Format: password */
            password: string;
            qq?: string;
            username?: string;
        };
        AccountRevokeAllData: {
            revoked: number;
        };
        AccountRevokeAllResponse: {
            data: components["schemas"]["AccountRevokeAllData"];
            msg: string;
        };
        AccountRevokedSessionsData: {
            revoked_sessions: number;
        };
        AccountRevokedSessionsResponse: {
            data: components["schemas"]["AccountRevokedSessionsData"];
            msg: string;
        };
        AccountSession: {
            client_id: string | null;
            /** @description 数据库时间 Y-m-d H:i:s */
            created_time: string | null;
            current: boolean;
            device_name: string;
            /** @description 数据库时间 Y-m-d H:i:s */
            expires_time: string | null;
            id: number;
            ip: string;
            /** @description 数据库时间 Y-m-d H:i:s */
            last_used_time: string | null;
            /** @enum {string} */
            login_type: "password" | "oauth";
            platform: string;
            scope: string;
            /** @enum {string} */
            status: "active" | "revoked" | "expired";
            ua_hash: string;
            /** @description 数据库时间 Y-m-d H:i:s */
            updated_time: string | null;
            user_id: number;
        };
        AccountSessionsData: {
            list: components["schemas"]["AccountSession"][];
        };
        AccountSessionsResponse: {
            data: components["schemas"]["AccountSessionsData"];
            msg: string;
        };
        /**
         * @description 现有异常处理器返回 JSON 编码的 {message} 文本，响应沿用 text/html 类型
         * @example {"message":"请求过于频繁"}
         */
        AccountUnhandledErrorBody: string;
        /** @description 按批次撤回或删除的通知回执数。 */
        AdminAffected: {
            affected: number;
        };
        /** @description 审计日志；detail 为各动作自己的 JSON 详情。 */
        AdminAuditLog: {
            /** @description 动作名,如 user.login / binding.revoke */
            action?: string;
            /** @description 操作者类型: platform/server/user/client */
            actor_type?: string;
            /** @description 操作者用户id,系统操作为空 */
            actor_user_id?: number | null;
            /** @description 相关应用client_id */
            client_id?: string | null;
            /** @description 记录时间 */
            created_time?: string | null;
            /** @description 详情JSON */
            detail?: {
                [key: string]: unknown;
            } | null;
            /** @description 主键 */
            id?: number;
            /** @description 来源IP */
            ip?: string;
            /** @description 相关空间id */
            server_id?: number | null;
            /** @description 目标id */
            target_id?: string;
            /** @description 目标类型 */
            target_type?: string;
        };
        /** @description 会话完整字段，包括当前模型未隐藏的 ua_hash。 */
        AdminAuthSession: {
            /** @description OAuth时关联的应用client_id */
            client_id?: string | null;
            /** @description 登录时间 */
            created_time?: string | null;
            /** @description 设备名(UA自动识别) */
            device_name?: string;
            /** @description 会话过期时间 */
            expires_time?: string | null;
            /** @description 会话id,即JWT中的sid */
            id?: number;
            /** @description 登录来源IP */
            ip?: string;
            /** @description 最近使用时间 */
            last_used_time?: string | null;
            /** @description 登录方式: password/oauth */
            login_type?: string;
            /** @description 平台: web/fivem/third_party */
            platform?: string;
            /** @description OAuth时授予的scope */
            scope?: string;
            /** @description 状态: active/revoked/expired */
            status?: string;
            /** @description UA摘要 */
            ua_hash?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
            /** @description 归属用户id */
            user_id?: number;
        };
        /** @description 全局绑定码列表；health：inactive 非 active、never 未心跳、stale 超过1800秒、ok 正常。 */
        AdminBindingListItem: {
            /** @description 绑定码 EX-XXXX-XXXX-XXXX-XXXX-XXXX */
            code?: string;
            /** @description 生成者用户id */
            created_by?: number | null;
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 过期时间,空=长期 */
            expires_time?: string | null;
            /** @description 功能键到布尔值的映射；空映射经模型 array cast 输出 [] */
            features?: {
                [key: string]: boolean;
            } | boolean[];
            /** @enum {string} */
            health?: "inactive" | "never" | "stale" | "ok";
            /** @description 主键 */
            id?: number;
            /** @description 最近心跳时间 */
            last_heartbeat?: string | null;
            /** @description 最近心跳来源IP */
            last_heartbeat_ip?: string;
            plugin?: components["schemas"]["AdminPluginBrief"] | (never | null);
            /** @description 插件id */
            plugin_id?: number;
            server?: components["schemas"]["AdminServerStateBrief"] | (never | null);
            /** @description 空间id */
            server_id?: number;
            /** @description 首次校验锁定的sv_licenseKey SHA-256 */
            server_key_hash?: string;
            /** @description 状态: active/revoked/disabled */
            status?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
        };
        /** @description 空间详情中的绑定码及关联插件。 */
        AdminBindingWithPlugin: {
            /** @description 绑定码 EX-XXXX-XXXX-XXXX-XXXX-XXXX */
            code?: string;
            /** @description 生成者用户id */
            created_by?: number | null;
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 过期时间,空=长期 */
            expires_time?: string | null;
            /** @description 功能键到布尔值的映射；空映射经模型 array cast 输出 [] */
            features?: {
                [key: string]: boolean;
            } | boolean[];
            /** @description 主键 */
            id?: number;
            /** @description 最近心跳时间 */
            last_heartbeat?: string | null;
            /** @description 最近心跳来源IP */
            last_heartbeat_ip?: string;
            plugin?: components["schemas"]["AdminPluginBrief"] | (never | null);
            /** @description 插件id */
            plugin_id?: number;
            /** @description 空间id */
            server_id?: number;
            /** @description 首次校验锁定的sv_licenseKey SHA-256 */
            server_key_hash?: string;
            /** @description 状态: active/revoked/disabled */
            status?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
        };
        /** @description 注册应用结果，明文密钥仅本次返回。 */
        AdminClientCreated: {
            client_id: string;
            /** @description 明文密钥仅本次返回，请立即保存。 */
            client_secret: string;
            id: number;
        };
        /** @description 应用列表及关联空间，不含密钥哈希。 */
        AdminClientListItem: {
            /** @description 公开client_id */
            client_id?: string;
            /** @description 创建者用户id */
            created_by?: number | null;
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 主键 */
            id?: number;
            /** @description 应用名称 */
            name?: string;
            /** @description 对接备注,仅超管可见 */
            note?: string;
            redirect_uris?: string[];
            scopes?: string[];
            server?: components["schemas"]["AdminServerBrief"] | (never | null);
            /** @description plugin类应用归属空间id,空=平台级 */
            server_id?: number | null;
            /** @description 状态: active/suspended */
            status?: string;
            /** @description 类型: third_party/plugin */
            type?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
        };
        /** @description 重置应用密钥结果，旧应用会话全部撤销。 */
        AdminClientSecret: {
            client_id: string;
            /** @description 明文密钥仅本次返回，请立即保存。 */
            client_secret: string;
        };
        /** @description 平台统计及最近10条审计日志；失联统计仅包括已锁定服务器 hash 的 active 绑定码。 */
        AdminDashboard: {
            bindings?: {
                active?: number;
                disabled?: number;
                revoked?: number;
                stale_heartbeat?: number;
            };
            plugins?: {
                online?: number;
                total?: number;
            };
            recent_logs?: components["schemas"]["AdminAuditLog"][];
            servers?: {
                active?: number;
                closed?: number;
                suspended?: number;
            };
            users?: {
                banned?: number;
                total?: number;
            };
        };
        /** @description 平台文档完整字段。 */
        AdminDoc: {
            /** @description 作者用户id */
            author_user_id?: number | null;
            /** @description 分类id */
            category_id?: number | null;
            /** @description 正文Markdown */
            content_md?: string;
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 主键 */
            id?: number;
            /** @description 归属: platform/server */
            owner_type?: string;
            /** @description owner_type=server时的空间id */
            server_id?: number | null;
            /** @description 全局唯一URL标识 */
            slug?: string;
            /** @description 状态: draft/published */
            status?: string;
            /** @description 标题 */
            title?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
            /** @description 版本号 */
            version?: number;
            /** @description 可见性: public/login/members/roles/servers/tags */
            visibility?: string;
            visible_roles?: string[] | null;
            visible_servers?: number[] | null;
            visible_tags?: number[] | null;
        };
        /** @description 平台文档分类。 */
        AdminDocCategory: {
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 主键 */
            id?: number;
            /** @description 分类名 */
            name?: string;
            /** @description 归属: platform/server */
            owner_type?: string;
            /** @description owner_type=server时的空间id */
            server_id?: number | null;
            /** @description 排序,小的在前 */
            sort?: number;
            /** @description 更新时间 */
            updated_time?: string | null;
        };
        /** @description 反馈附件元数据，不包含存储路径和下载地址。 */
        AdminFeedbackAttachment: {
            byte_length?: number;
            content_type?: string;
            created_time?: string | null;
            id?: number;
            ordinal?: number;
            original_name?: string;
            sha256?: string;
            /** @enum {string} */
            status?: "expected" | "uploaded";
            /** Format: uuid */
            uuid?: string;
        };
        /** @description 工单表单快照、管理员备注和附件元数据。 */
        AdminFeedbackDetail: {
            admin_note?: string | null;
            /** @enum {string} */
            admin_status?: "pending" | "processing" | "resolved";
            /** @enum {string} */
            area?: "development" | "community";
            attachments?: components["schemas"]["AdminFeedbackAttachment"][];
            created_time?: string | null;
            form?: components["schemas"]["AdminFeedbackForm"];
            id?: number;
            /** @enum {string} */
            kind?: "bug" | "feature" | "asset" | "request" | "content" | "campaign" | "suggestion" | "complaint";
            /** @enum {string} */
            status?: "receiving" | "completed";
            /** Format: uuid */
            submission_key?: string;
            updated_time?: string | null;
            user?: components["schemas"]["AdminUserBrief"] | (never | null);
            /** Format: uuid */
            uuid?: string;
        };
        /** @description 用户表单快照；后端只校验 kind/title，其余字段按原样保存。 */
        AdminFeedbackForm: {
            /** @enum {string} */
            kind: "bug" | "feature" | "asset" | "request" | "content" | "campaign" | "suggestion" | "complaint";
            title: string;
        } & {
            [key: string]: unknown;
        };
        /** @description 反馈工单列表。 */
        AdminFeedbackListItem: {
            /** @enum {string} */
            admin_status?: "pending" | "processing" | "resolved";
            /** @enum {string} */
            area?: "development" | "community";
            attachment_count?: number;
            created_time?: string | null;
            id?: number;
            /** @enum {string} */
            kind?: "bug" | "feature" | "asset" | "request" | "content" | "campaign" | "suggestion" | "complaint";
            /** @enum {string} */
            status?: "receiving" | "completed";
            /** Format: uuid */
            submission_key?: string;
            title?: string;
            updated_time?: string | null;
            user?: components["schemas"]["AdminUserBrief"] | (never | null);
            /** Format: uuid */
            uuid?: string;
        };
        /** @description 新建记录的 ID。 */
        AdminId: {
            id: number;
        };
        /** @description 空间详情中的成员用户选定字段。 */
        AdminMemberUser: {
            avatar?: string;
            email?: string;
            id?: number;
            username?: string;
        };
        /** @description 用户详情中的成员关系和空间。 */
        AdminMemberWithServer: {
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 主键 */
            id?: number;
            /** @description 加入时间 */
            joined_time?: string | null;
            /** @description 空间角色: owner/admin/member */
            role_key?: string;
            server?: components["schemas"]["AdminServerStateBrief"] | (never | null);
            /** @description 空间id */
            server_id?: number;
            /** @description 入空间方式: grant/manual/bind */
            source?: string;
            /** @description 状态: active/banned/left */
            status?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
            /** @description 用户id */
            user_id?: number;
        };
        /** @description 空间详情成员及关联用户。 */
        AdminMemberWithUser: {
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 主键 */
            id?: number;
            /** @description 加入时间 */
            joined_time?: string | null;
            /** @description 空间角色: owner/admin/member */
            role_key?: string;
            /** @description 空间id */
            server_id?: number;
            /** @description 入空间方式: grant/manual/bind */
            source?: string;
            /** @description 状态: active/banned/left */
            status?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
            user?: components["schemas"]["AdminMemberUser"] | (never | null);
            /** @description 用户id */
            user_id?: number;
        };
        /** @description 按批次聚合的通知记录。 */
        AdminNotificationBatch: {
            /** Format: uuid */
            batch_uuid?: string;
            /** @enum {string} */
            category?: "announcement" | "personal_update" | "service_notice";
            created_time?: string | null;
            expires_time?: string | null;
            /** @enum {string} */
            necessity?: "optional" | "necessary";
            recipients?: number;
            /** @enum {string} */
            scope?: "community" | "personal";
            /** @enum {string} */
            status?: "expired" | "active";
            title?: string;
            unread?: number;
        };
        /** @description 发送后的通知批次和接收人数。 */
        AdminNotificationCreated: {
            /** Format: uuid */
            batch_uuid: string;
            recipients: number;
        };
        /** @description 绑定码关联插件字段；插件下拉选项仅包含在线插件。 */
        AdminPluginBrief: {
            id?: number;
            name?: string;
            slug?: string;
            /** @enum {string} */
            status?: "draft" | "online" | "offline";
        };
        /** @description 插件功能点字典。 */
        AdminPluginFeature: {
            /** @description 空间未显式配置时是否默认开启 */
            default_enabled?: boolean;
            /** @description 功能键,如 nitro */
            feature_key?: string;
            /** @description 主键 */
            id?: number;
            /** @description 功能中文名 */
            name?: string;
            /** @description 所属插件id */
            plugin_id?: number;
        };
        /** @description 插件列表及功能点、绑定码数量。 */
        AdminPluginListItem: {
            bindings_count?: number;
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 详情(Markdown) */
            description_md?: string;
            /** @description 平台文档默认分类id,预留 */
            doc_category_id?: number | null;
            features_count?: number;
            /** @description 主键 */
            id?: number;
            /** @description 最新版本号 */
            latest_version?: string;
            /** @description 插件名称 */
            name?: string;
            /** @description 插件唯一标识,如 ex-tuner */
            slug?: string;
            /** @description 状态: draft/online/offline */
            status?: string;
            /** @description 一句话简介 */
            summary?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
        };
        /** @description 空间下拉选项和应用归属空间。 */
        AdminServerBrief: {
            id?: number;
            name?: string;
            slug?: string;
        };
        /** @description 空间基本信息、成员及绑定码。 */
        AdminServerDetail: {
            bindings: components["schemas"]["AdminBindingWithPlugin"][];
            members: components["schemas"]["AdminMemberWithUser"][];
            server: components["schemas"]["AdminServerWithOwner"];
        };
        /** @description 空间列表，附成员和绑定码数量。 */
        AdminServerListItem: {
            bindings_count?: number;
            /** @description 联系QQ */
            contact_qq?: string;
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 空间介绍 */
            description?: string;
            /** @description 空间唯一标识 */
            id?: number;
            /** @description 空间图标地址 */
            logo?: string;
            members_count?: number;
            /** @description 空间名称 */
            name?: string;
            /** @description 平台备注,仅超管可见 */
            note?: string;
            owner?: components["schemas"]["AdminUserBrief"] | (never | null);
            /** @description Owner用户id */
            owner_user_id?: number;
            /** @description 空间短标识,全局唯一 */
            slug?: string;
            /** @description 状态: active/suspended/closed */
            status?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
        };
        /** @description 绑定码和用户成员关系关联的空间字段。 */
        AdminServerStateBrief: {
            id?: number;
            name?: string;
            slug?: string;
            /** @enum {string} */
            status?: "active" | "suspended" | "closed";
        };
        /** @description 空间完整字段及所有者选定字段。 */
        AdminServerWithOwner: {
            /** @description 联系QQ */
            contact_qq?: string;
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 空间介绍 */
            description?: string;
            /** @description 空间唯一标识 */
            id?: number;
            /** @description 空间图标地址 */
            logo?: string;
            /** @description 空间名称 */
            name?: string;
            /** @description 平台备注,仅超管可见 */
            note?: string;
            owner?: components["schemas"]["AdminUserBrief"] | (never | null);
            /** @description Owner用户id */
            owner_user_id?: number;
            /** @description 空间短标识,全局唯一 */
            slug?: string;
            /** @description 状态: active/suspended/closed */
            status?: string;
            /** @description 更新时间 */
            updated_time?: string | null;
        };
        /** @description Redis 中仍存在的设备及 SSO 请求，不分页。 */
        AdminSsoRequest: {
            client_id?: string;
            client_name?: string;
            /** @description 创建至今秒数，按600秒有效期推算。 */
            created_ago?: number;
            device_code?: string;
            sso_request_id?: string;
            status?: string;
            /** @description 剩余有效秒数。 */
            ttl?: number;
            user_code?: string;
            user_id?: number | null;
            username?: string;
        };
        /** @description 保存后有效且去重的用户标签 ID。 */
        AdminTagIds: {
            tag_ids: number[];
        };
        /** @description 标签列表及关联用户数量。 */
        AdminTagListItem: {
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 主键 */
            id?: number;
            /** @description 标签名,全局唯一 */
            name?: string;
            /** @description 备注 */
            note?: string;
            user_count?: number;
        };
        /** @description 用户完整序列化字段，不返回 password_hash。 */
        AdminUser: {
            /** @description 头像地址 */
            avatar?: string;
            /** @description 封禁标记: 0正常 1封禁 */
            ban?: number;
            /** @description 创建时间 */
            created_time?: string | null;
            /** @description 登录邮箱,全局唯一 */
            email?: string;
            /** @description 用户唯一标识 */
            id?: number;
            /** @description 最近登录时间 */
            last_login_time?: string | null;
            /** @description 用户等级,预留 */
            level?: number;
            /** @description 平台角色: ''/ops/superadmin */
            platform_role?: string;
            /** @description 联系QQ号,可空,唯一 */
            qq?: string | null;
            /** @description 更新时间 */
            updated_time?: string | null;
            /** @description 显示昵称 */
            username?: string;
        };
        /** @description 关联用户的选定字段。 */
        AdminUserBrief: {
            email?: string;
            id?: number;
            username?: string;
        };
        /** @description 用户详情，含最近50条会话和20条审计日志。 */
        AdminUserDetail: {
            recent_logs: components["schemas"]["AdminAuditLog"][];
            servers: components["schemas"]["AdminMemberWithServer"][];
            sessions: components["schemas"]["AdminAuthSession"][];
            tags: {
                id?: number;
                name?: string | null;
            }[];
            user: components["schemas"]["AdminUser"];
        };
        /** @description 文档当前版本号。 */
        AdminVersion: {
            version: number;
        };
        BusinessErrorBody: {
            /** @description 中文业务错误消息。 */
            msg: string;
        };
        ContentBrowseData: {
            list?: components["schemas"]["ContentDocumentSummary"][];
        };
        ContentCategoriesData: {
            list?: components["schemas"]["ContentCategory"][];
        };
        ContentCategory: {
            created_time?: string | null;
            id?: number;
            name?: string;
            /** @enum {string} */
            owner_type?: "platform" | "server";
            server_id?: number | null;
            sort?: number;
            updated_time?: string | null;
        };
        ContentCategoryInput: {
            /** @description trim 后非空 */
            name: string;
            /** @default 0 */
            sort: number;
        };
        ContentDocStatusInput: {
            /** @enum {string} */
            status: "draft" | "published";
        };
        ContentDocument: {
            author_user_id?: number | null;
            category_id?: number | null;
            content_md?: string;
            created_time?: string | null;
            id?: number;
            /** @enum {string} */
            owner_type?: "platform" | "server";
            server_id?: number | null;
            slug?: string;
            /** @enum {string} */
            status?: "draft" | "published";
            title?: string;
            updated_time?: string | null;
            version?: number;
            /** @enum {string} */
            visibility?: "public" | "login" | "members" | "roles" | "servers" | "tags";
            visible_roles?: ("owner" | "admin" | "member")[] | null;
            visible_servers?: number[] | null;
            visible_tags?: number[] | null;
        };
        ContentDocumentSummary: {
            category_id?: number | null;
            /** @description 文档管理和浏览的数据结构。 */
            id?: number;
            /** @enum {string} */
            owner_type?: "platform" | "server";
            server_id?: number | null;
            slug?: string;
            title?: string;
            updated_time?: string | null;
            version?: number;
            /** @enum {string} */
            visibility?: "public" | "login" | "members" | "roles" | "servers" | "tags";
            visible_roles?: ("owner" | "admin" | "member")[] | null;
            visible_servers?: number[] | null;
            visible_tags?: number[] | null;
        };
        ContentManagedDocsData: {
            list?: components["schemas"]["ContentDocument"][];
            total?: number;
        };
        /** @description visibility 默认 members，content_md 默认空；归属与作者由服务端设置。roles 至少一个有效角色，否则 400；非 roles 的 visible_roles 存 null。 */
        ContentServerDocCreateInput: {
            /** @description 0 转为 null；当前控制器不校验分类归属 */
            category_id?: number;
            content_md?: string;
            /** @description 转小写并 trim；仅接受 ^[a-z0-9][a-z0-9-]{0,60}$，无效或冲突自动生成唯一 doc- 标识 */
            slug?: string;
            /**
             * @description 无效状态回退 draft
             * @default draft
             * @enum {string}
             */
            status: "draft" | "published";
            /** @description 创建时 trim 后必填；更新时为空则忽略 */
            title: string;
            /** @enum {string} */
            visibility?: "public" | "members" | "roles";
            visible_roles?: ("owner" | "admin" | "member")[];
        };
        /** @description 仅更新提供的字段；status 不在本接口更新。有效编辑 version +1；角色数组仅保留 owner/admin/member，roles 至少一个角色。 */
        ContentServerDocUpdateInput: {
            /** @description 0 转为 null；当前控制器不校验分类归属 */
            category_id?: number;
            content_md?: string;
            /** @description 转小写并 trim；仅接受 ^[a-z0-9][a-z0-9-]{0,60}$，无效或冲突自动生成唯一 doc- 标识 */
            slug?: string;
            /** @description 创建时 trim 后必填；更新时为空则忽略 */
            title?: string;
            /** @enum {string} */
            visibility?: "public" | "members" | "roles";
            visible_roles?: ("owner" | "admin" | "member")[];
        };
        FeedbackActionOption: {
            /** @enum {string} */
            action: "add" | "modify" | "delete" | "other";
            available: boolean;
            /** @enum {string|null} */
            reason: null;
        };
        FeedbackAdvanceRequest: {
            expectedRevision: number;
            /** @enum {string} */
            intent: "continue" | "retry";
        };
        FeedbackAttachment: {
            byteLength: number;
            contentType: string;
            /** Format: uuid */
            id: string;
            ordinal: number;
            originalName: string;
            /** @enum {string|null} */
            remoteAttachmentId: null;
            sha256: string;
            /** @enum {string} */
            status: "expected" | "uploaded";
        };
        FeedbackAttachmentDeclaration: {
            byteLength: number;
            /** @description 原样声明，存储时截断为 127 字符 */
            contentType: string;
            /**
             * Format: uuid
             * @description 可选 UUID v4；缺失或无效时由服务端生成
             */
            id?: string;
            /** @description 存储时截断为 510 字符 */
            originalName: string;
            /** @description 原始字节 SHA-256 小写摘要 */
            sha256: string;
        };
        FeedbackAttachmentUploadRequest: {
            /**
             * Format: binary
             * @description 最多 20MiB；字节数及 SHA-256 须与声明完全一致
             */
            file: string;
        };
        /** @description PHP 校验 kind/title 并完整保存其他表单字段；JSON 编码后超过 131072 字节返回 413 */
        FeedbackForm: {
            /**
             * @description 实际 PHP 请求与响应结构。
             * @enum {string}
             */
            kind: "bug" | "feature" | "asset" | "request" | "content" | "campaign" | "suggestion" | "complaint";
            title: string;
        } & {
            [key: string]: unknown;
        };
        FeedbackKindOption: {
            available: boolean;
            /** @enum {string} */
            kind: "bug" | "feature" | "asset" | "request" | "content" | "campaign" | "suggestion" | "complaint";
            /** @enum {string|null} */
            reason: null;
        };
        FeedbackLimits: {
            /** @enum {integer} */
            fileBytes: 20971520;
            /** @enum {integer} */
            files: 5;
            /** @enum {integer} */
            largeFileInfoBytes: 65536;
            /** @enum {integer} */
            titleCodePoints: 200;
            /** @enum {integer} */
            totalFileBytes: 104857600;
            /** @enum {integer} */
            userContentBytes: 65536;
        };
        FeedbackOptionsData: {
            actions: components["schemas"]["FeedbackActionOption"][];
            available: boolean;
            fields: string[];
            kinds: components["schemas"]["FeedbackKindOption"][];
            limits: components["schemas"]["FeedbackLimits"];
            /** @enum {string|null} */
            reason: null;
        };
        FeedbackOptionsResponse: {
            data: components["schemas"]["FeedbackOptionsData"];
            msg: string;
        };
        FeedbackPrepareRequest: {
            attachments: components["schemas"]["FeedbackAttachmentDeclaration"][];
            form: components["schemas"]["FeedbackForm"];
            /**
             * Format: uuid
             * @description 客户端 UUID v4；同一用户与键重放返回原快照
             */
            submissionKey: string;
        };
        FeedbackSnapshotData: {
            attachments: components["schemas"]["FeedbackAttachment"][];
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            createdAt: number;
            /** @enum {string|null} */
            failure: null;
            form: components["schemas"]["FeedbackForm"];
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            nextAction: "upload" | "continue" | "done";
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            receiveExpiresAt: number;
            revision: number;
            /** @enum {string} */
            status: "receiving" | "completed";
            /** Format: uuid */
            submissionKey: string;
            /** @enum {string|null} */
            taskId: null;
            /** @enum {string|null} */
            taskUrl: null;
        };
        FeedbackSnapshotResponse: {
            data: components["schemas"]["FeedbackSnapshotData"];
            msg: string;
        };
        NotificationAction: {
            actionId: string;
            emphasis: string;
            enabled: boolean;
            kind: string;
            label: string;
            navigationTarget: components["schemas"]["NotificationNavigationTarget"];
            /** @enum {string|null} */
            unavailableReason: "expired" | "unsupported" | null;
        };
        NotificationClearAllData: {
            affectedCount: number;
            batchId: string;
            replayed: boolean;
            requestId: string;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            serverTime: number;
            skippedCount: number;
            unreadCount: number;
        };
        NotificationClearAllRequest: {
            clearSnapshotToken: string;
            /** @description 十分钟幂等结果键；全部已读与清理共用命名空间 */
            requestId: string;
        };
        NotificationClearAllResponse: {
            data: components["schemas"]["NotificationClearAllData"];
            msg: string;
        };
        NotificationClearPreviewData: {
            /** Format: uuid */
            batchId: string;
            /** @description 绑定用户、批次及上界，十分钟有效 */
            clearSnapshotToken: string;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            expiresAt: number;
            itemCount: number;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            serverTime: number;
            upperSequence: number;
        };
        NotificationClearPreviewResponse: {
            data: components["schemas"]["NotificationClearPreviewData"];
            msg: string;
        };
        NotificationContent: {
            /** @enum {string} */
            format: "html";
            html: string;
            /** @enum {string} */
            policyVersion: "notification-html-v1";
            /** @enum {integer} */
            schemaVersion: 1;
            text: string;
        } | null;
        NotificationDetailData: {
            actions: components["schemas"]["NotificationAction"][];
            actionsAvailable: boolean;
            /** @enum {string} */
            category: "announcement" | "personal_update" | "service_notice";
            clearRevision: number;
            /** @enum {integer|null} */
            clearedAt: null;
            content: components["schemas"]["NotificationContent"];
            contentAvailable: boolean;
            contentFallbackText: string | null;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            deliveredAt: number;
            /** @enum {string} */
            lifecycle: "active" | "expired";
            /** @enum {string} */
            necessity: "optional" | "necessary";
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            readAt: number | null;
            /** Format: uuid */
            receiptId: string;
            /** @enum {string} */
            scope: "community" | "personal";
            sequence: number;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            serverTime: number;
            stateRevision: number;
            title: string;
        };
        NotificationDetailResponse: {
            data: components["schemas"]["NotificationDetailData"];
            msg: string;
        };
        NotificationItem: {
            /** @enum {string} */
            category: "announcement" | "personal_update" | "service_notice";
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            deliveredAt: number;
            expired: boolean;
            /** @enum {string} */
            necessity: "optional" | "necessary";
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            readAt: number | null;
            /**
             * Format: uuid
             * @description 实际 PHP 请求与响应结构。
             */
            receiptId: string;
            /** @enum {string} */
            scope: "community" | "personal";
            sequence: number;
            stateRevision: number;
            summaryText: string;
            title: string;
        };
        NotificationListData: {
            items: components["schemas"]["NotificationItem"][];
            nextCursor: string | null;
            readThroughToken: string;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            serverTime: number;
            unreadCount: number;
            upperSequence: number;
        };
        NotificationListResponse: {
            data: components["schemas"]["NotificationListData"];
            msg: string;
        };
        NotificationNavigationTarget: {
            /** @enum {string} */
            kind: "internal";
            path: string;
        } | null;
        NotificationOptionalCategories: {
            announcement: boolean;
            personal_update: boolean;
        };
        NotificationPreferencesData: {
            /** @description 固定包含 service_notice，不可关闭 */
            necessaryCategories: string[];
            optionalCategories: components["schemas"]["NotificationOptionalCategories"];
            revision: number;
            /**
             * Format: int64
             * @description Unix 时间戳（秒）
             */
            serverTime: number;
        };
        NotificationPreferencesRequest: {
            expectedRevision: number;
            optionalCategories: components["schemas"]["NotificationOptionalCategories"];
        };
        NotificationPreferencesResponse: {
            data: components["schemas"]["NotificationPreferencesData"];
            msg: string;
        };
        NotificationReadAllData: {
            affectedCount: number;
            replayed: boolean;
            requestId: string;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            serverTime: number;
            unreadCount: number;
            watermarkSequence: number;
        };
        NotificationReadAllRequest: {
            readThroughToken: string;
            /** @description 十分钟幂等结果键；全部已读与清理共用命名空间 */
            requestId: string;
        };
        NotificationReadAllResponse: {
            data: components["schemas"]["NotificationReadAllData"];
            msg: string;
        };
        NotificationStateData: {
            read: boolean;
            receiptId: string;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            serverTime: number;
            stateRevision: number;
            unreadCount: number;
        };
        NotificationStateRequest: {
            expectedRevision: number;
            read: boolean;
        };
        NotificationStateResponse: {
            data: components["schemas"]["NotificationStateData"];
            msg: string;
        };
        NotificationSummaryData: {
            /** @description 绑定用户与上界，十分钟有效 */
            readThroughToken: string;
            /**
             * Format: int64
             * @description Unix 时间戳（毫秒）
             */
            serverTime: number;
            stateVersion: number;
            unreadCount: number;
            upperSequence: number;
        };
        NotificationSummaryResponse: {
            data: components["schemas"]["NotificationSummaryData"];
            msg: string;
        };
        OAuthAuthorizationConfirmRequest: {
            client_id: string;
            code_challenge?: string;
            /**
             * @description S256 不区分大小写，其余值按 plain 处理。
             * @default plain
             */
            code_challenge_method: string;
            redirect_uri: string;
            /** @description 空格分隔；与应用允许 scope 取交集，并补充 user.basic。 */
            scope?: string;
            state: string;
        };
        OAuthAuthorizationConfirmResponse: {
            data: {
                /** @description 回调白名单地址附加 code 与原始 state；接口本身不执行 HTTP 重定向。 */
                redirect: string;
            };
            msg: string;
        };
        OAuthAuthorizationInfoResponse: {
            data: components["schemas"]["OAuthAuthorizationInfoResponseData"];
            msg: string;
        };
        OAuthAuthorizationInfoResponseData: {
            client_id: string;
            name: string;
            scope_labels: string[];
            scopes: string[];
            /** @enum {string} */
            type: "third_party";
        };
        OAuthDeviceVerifyRequest: {
            /** @description 初始化返回的六位用户码；当前实现只做非空与 Redis 查找。 */
            user_code: string;
        };
        OAuthDeviceVerifyResponse: {
            data: {
                app_name: string;
            };
            msg: string;
        };
        ServerAccount: {
            contact_qq?: string;
            created_time?: string | null;
            description?: string;
            /** @description 空间管理接口的数据结构。 */
            id?: number;
            logo?: string;
            name?: string;
            /** @description 当前完整模型序列化包含平台备注字段 */
            note?: string;
            owner_user_id?: number;
            slug?: string;
            /** @enum {string} */
            status?: "active" | "suspended" | "closed";
            updated_time?: string | null;
        };
        ServerBinding: {
            /** @description 完整绑定码，仅空间管理端返回；无真实凭据示例 */
            code?: string;
            created_by?: number | null;
            created_time?: string | null;
            expires_time?: string | null;
            /** @description 功能键到布尔值的映射；空映射经 array cast 可输出 [] */
            features?: {
                [key: string]: boolean;
            } | boolean[];
            id?: number;
            last_heartbeat?: string | null;
            last_heartbeat_ip?: string;
            plugin?: components["schemas"]["ServerBindingPlugin"] | (never | null);
            plugin_id?: number;
            server_id?: number;
            /** @description 当前序列化包含首次绑定的服务器密钥 SHA-256；未绑定为空字符串 */
            server_key_hash?: string;
            /** @enum {string} */
            status?: "active" | "revoked" | "disabled";
            updated_time?: string | null;
        };
        ServerBindingCodeData: {
            code?: string;
        };
        ServerBindingPlugin: {
            id?: number;
            name?: string;
            slug?: string;
            /** @enum {string} */
            status?: "draft" | "online" | "offline";
        };
        ServerBindingsData: {
            list?: components["schemas"]["ServerBinding"][];
            plugin_options?: components["schemas"]["ServerPluginOption"][];
            /** @enum {string|null} */
            server_status?: "active" | "suspended" | "closed" | null;
        };
        ServerBoundUser: {
            id?: number;
            username?: string;
        };
        ServerClient: {
            client_id?: string;
            /** @enum {string} */
            client_status?: "active" | "suspended";
            disconnected_time?: string | null;
            id?: number;
            /** @enum {string} */
            link_status?: "active" | "disconnected";
            name?: string;
            scopes?: string[];
        };
        ServerClientInput: {
            client_id: string;
        };
        ServerClientsData: {
            list?: components["schemas"]["ServerClient"][];
        };
        ServerCreatedIdData: {
            id?: number;
        };
        ServerFeature: {
            default_enabled?: boolean;
            feature_key?: string;
            id?: number;
            name?: string;
            plugin_id?: number;
        };
        ServerFeatureSummary: {
            default_enabled?: boolean;
            feature_key?: string;
            name?: string;
        };
        ServerIdent: {
            bound_server_id?: number | null;
            created_time?: string | null;
            id?: number;
            /** @enum {string} */
            ident_type?: "fivem_license" | "steam" | "discord" | "qq";
            /** @description 列表当前返回完整游戏标识 */
            ident_value?: string;
            user?: components["schemas"]["ServerUserSummary"] | (never | null);
            user_id?: number;
        };
        ServerIdentBindInput: {
            /** @description 游戏中生成的一次性 ticket，300 秒有效；取出后即消费，后续校验失败也不恢复 */
            ticket: string;
            user_id: number;
        };
        ServerIdentBoundData: {
            /** @description 省略号加标识最后 8 位 */
            ident_tail?: string;
            user?: components["schemas"]["ServerBoundUser"];
        };
        ServerIdentsData: {
            list?: components["schemas"]["ServerIdent"][];
        };
        ServerManagedSpace: {
            id?: number;
            logo?: string;
            /** @enum {string} */
            my_role?: "owner" | "admin";
            name?: string;
            slug?: string;
        };
        ServerMember: {
            created_time?: string | null;
            id?: number;
            joined_time?: string | null;
            /** @enum {string} */
            role_key?: "owner" | "admin" | "member";
            server_id?: number;
            /** @enum {string} */
            source?: "grant" | "manual" | "bind";
            /** @enum {string} */
            status?: "active" | "banned" | "left";
            updated_time?: string | null;
            user?: components["schemas"]["ServerMemberUser"] | (never | null);
            user_id?: number;
        };
        ServerMemberAddInput: {
            /** @description 邮箱或 QQ 精确匹配；去除首尾空白后非空 */
            keyword: string;
            /**
             * @default member
             * @enum {string}
             */
            role: "admin" | "member";
        };
        ServerMemberPermission: {
            allowed?: boolean;
            binding_id?: number;
            /** @enum {string} */
            binding_status?: "active" | "revoked" | "disabled";
            feature_list?: components["schemas"]["ServerFeatureSummary"][];
            /** @description 功能键到布尔值的映射或布尔数组；连续数字键经 PHP 数组序列化可输出非空数组，null 表示无功能覆盖 */
            features?: ({
                [key: string]: boolean;
            } | null) | boolean[];
            has_perm_row?: boolean;
            plugin_id?: number;
            plugin_name?: string | null;
            plugin_slug?: string | null;
            plugin_status?: string | null;
        };
        ServerMemberPermissionsData: {
            list?: components["schemas"]["ServerMemberPermission"][];
            member?: components["schemas"]["ServerPermissionMember"];
        };
        ServerMemberRoleInput: {
            /** @enum {string} */
            role: "admin" | "member";
        };
        ServerMemberUser: {
            avatar?: string;
            email?: string;
            id?: number;
            qq?: string | null;
            username?: string;
        };
        ServerMembersData: {
            list?: components["schemas"]["ServerMember"][];
            /** @enum {string} */
            my_role?: "owner" | "admin" | "member";
        };
        ServerMineData: {
            list?: components["schemas"]["ServerManagedSpace"][];
        };
        ServerOverviewData: {
            binding_count?: number;
            ident_count?: number;
            member_count?: number;
            /** @enum {string} */
            my_role?: "owner" | "admin" | "member";
            server?: components["schemas"]["ServerAccount"];
        };
        ServerPermissionBinding: {
            expires_time?: string | null;
            /** @description 功能键到布尔值的映射；空映射经 array cast 可输出 [] */
            features?: {
                [key: string]: boolean;
            } | boolean[];
            id?: number;
            plugin_id?: number;
            /** @enum {string} */
            status?: "active" | "revoked" | "disabled";
        };
        ServerPermissionMatrixData: {
            binding?: components["schemas"]["ServerPermissionBinding"];
            features?: components["schemas"]["ServerFeature"][];
            rows?: components["schemas"]["ServerPermissionRow"][];
        };
        ServerPermissionMember: {
            /** @description 没有插件绑定时此字段省略 */
            avatar?: string | null;
            email?: string | null;
            /** @enum {string} */
            role_key?: "owner" | "admin" | "member";
            user_id?: number;
            username?: string | null;
        };
        ServerPermissionPushData: {
            plugins?: string[];
        };
        ServerPermissionPushInput: {
            /**
             * @description 大于 0 仅下发指定插件，省略或不大于 0 下发全部绑定插件
             * @default 0
             */
            plugin_id: number;
        };
        ServerPermissionRow: {
            /** @description 没有覆盖记录时为 true */
            allowed?: boolean;
            email?: string | null;
            /** @description 功能键到布尔值的映射或布尔数组；连续数字键经 PHP 数组序列化可输出非空数组，null 表示无功能覆盖 */
            features?: ({
                [key: string]: boolean;
            } | null) | boolean[];
            has_perm_row?: boolean;
            /** @enum {string} */
            role_key?: "owner" | "admin" | "member";
            user_id?: number;
            username?: string | null;
        };
        /** @description 仅保留该插件已知功能键并转为 bool；features 缺失或 null 清除功能覆盖，空映射保留空覆盖记录。 */
        ServerPermissionSaveInput: {
            /** @default true */
            allowed: boolean;
            /** @description 功能键到布尔值的映射或布尔数组；连续数字键经 PHP 数组序列化可输出非空数组，null 表示无功能覆盖 */
            features?: ({
                [key: string]: boolean;
            } | null) | boolean[];
            plugin_id: number;
            user_id: number;
        };
        ServerPermissionTargetInput: {
            plugin_id: number;
            user_id: number;
        };
        ServerPluginIdInput: {
            plugin_id: number;
        };
        ServerPluginOption: {
            id?: number;
            name?: string;
            slug?: string;
        };
        ServerSettingsInput: {
            contact_qq?: string;
            description?: string;
            logo?: string;
            name?: string;
        };
        ServerUserSummary: {
            avatar?: string;
            email?: string;
            id?: number;
            username?: string;
        };
        ServerVersionData: {
            version?: number;
        };
        SsoCaptcha: {
            answer: string;
            challengeId: string;
        };
        SsoCompletedResponse: {
            data: {
                /** @description 由设备码初始化接口返回的 sso_request_id。 */
                ssoRequestId: string;
                /** @enum {string} */
                status: "completed";
            };
            msg: string;
        };
        SsoInspectResponse: {
            data: {
                /**
                 * Format: int64
                 * @description Unix 毫秒时间。
                 */
                expiresAt: number;
                /**
                 * Format: int64
                 * @description Unix 毫秒时间。
                 */
                serverTime: number;
                /** @description 由设备码初始化接口返回的 sso_request_id。 */
                ssoRequestId: string;
                /** @enum {string} */
                status: "pending" | "completed";
            };
            msg: string;
        };
        SsoLoginRequest: {
            captcha?: components["schemas"]["SsoCaptcha"];
            /** @description 登录邮箱，去除两端空白。 */
            email: string;
            password: string;
            /** @description 由设备码初始化接口返回的 sso_request_id。 */
            ssoRequestId: string;
        };
        SsoRequest: {
            /** @description 由设备码初始化接口返回的 sso_request_id。 */
            ssoRequestId: string;
        };
        StoragePrepareData: {
            /** @enum {integer} */
            maxBytes: 20971520;
            /** @enum {string} */
            medium: "file";
        };
        StoragePrepareRequest: {
            /** @description 合法 type/subtype，不接受参数 */
            contentType: string;
            /** @description 小写分段路径，禁止 Windows 保留设备名 */
            key: string;
            /** @enum {string} */
            medium?: "file" | "cos";
            /** @description 超过 20MiB 返回 413 */
            size: number;
        };
        StoragePrepareResponse: {
            data: components["schemas"]["StoragePrepareData"];
            msg: string;
        };
        StorageUploadData: {
            /** Format: uri */
            url: string;
        };
        StorageUploadRequest: {
            /** @description 合法 type/subtype，不接受参数 */
            contentType?: string;
            /**
             * Format: binary
             * @description 文件字节，最多 20MiB
             */
            data: string;
            /** @description 小写分段路径，禁止 Windows 保留设备名 */
            key: string;
            /** @enum {string} */
            medium?: "file";
        };
        StorageUploadResponse: {
            data: components["schemas"]["StorageUploadData"];
            msg: string;
        };
        SystemEnvironmentCheck: {
            name: string;
            passed: boolean;
        };
        SystemHealthData: {
            /**
             * @description 健康检查与首次部署初始化的数据结构。
             * @enum {string}
             */
            status: "ok";
        };
        SystemInstallAdminInput: {
            /** Format: email */
            email: string;
            /**
             * Format: password
             * @description 12..72 字节，至少一个字母和数字；禁止控制字符
             */
            password: string;
            /**
             * Format: password
             * @description 必须与 password 完全一致
             */
            password_confirmation: string;
            username: string;
        };
        SystemInstallData: {
            /** @enum {boolean} */
            installed: true;
        };
        SystemInstallDatabaseInput: {
            database: string;
            host: string;
            /** @description 可为空，不提供真实示例 */
            password: string;
            /** @description 接受整数或数字字符串；数值范围 1..65535 */
            port: number | string;
            username: string;
        };
        /** @description 连接信息/管理员字段仅接受字符串或整数且禁止控制字符；除 password 外 trim 后不能为空。写入 .env、生成 JWT 密钥并创建 install.lock；不导入 seed.sql。 */
        SystemInstallInput: {
            admin: components["schemas"]["SystemInstallAdminInput"];
            database: components["schemas"]["SystemInstallDatabaseInput"];
            /**
             * @description 必须为 JSON 布尔值；true 在事务内重建 public 下全部 app_ 业务表
             * @default false
             */
            force: boolean;
            /** @description force=true 时必须精确等于“重置数据库” */
            force_confirmation?: string;
            redis: components["schemas"]["SystemInstallRedisInput"];
        };
        SystemInstallRedisInput: {
            /** @description 接受整数或数字字符串；数值范围 0..65535 */
            database: number | string;
            host: string;
            /** @description 可为空，不提供真实示例 */
            password: string;
            /** @description 接受整数或数字字符串；数值范围 1..65535 */
            port: number | string;
        };
        /** @description 已安装仅返回 installed=true；未安装返回 installed=false、checks、ready。检查 PHP >=8.1、pdo_pgsql、redis、gd、mbstring、项目及 .env 可写、schema.sql 可读。install.lock 或已有 superadmin 均视为已安装；后者可补写标记。不返回连接凭据。 */
        SystemInstallationStatusData: {
            checks?: components["schemas"]["SystemEnvironmentCheck"][];
            installed: boolean;
            ready?: boolean;
        };
    };
    responses: {
        /** @description 业务错误；HTTP 状态码由接口具体分支决定。 */
        BusinessError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BusinessErrorBody"];
            };
        };
        /** @description 系统尚未初始化。 */
        SetupRequired: {
            headers: {
                /** @description 值为 1，提示先完成初始化。 */
                "X-Setup-Required"?: "1";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BusinessErrorBody"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    accountGrants: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountGrantsResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountRevokeGrant: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                client_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountRevokedSessionsResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountAdminLoginRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountAdminLoginRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountLoginResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            422: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountLogout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountEmptyResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountMeResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountChangePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountPasswordRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountPasswordRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountRevokedSessionsResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountRegister: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountRegisterRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountRegisterRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountLoginResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountSendEmailCode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountEmailRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountEmailRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountEmailCodeResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            /** @description 注解限流异常由现有 ApiHandler 转成 500 */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": components["schemas"]["AccountUnhandledErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    accountSessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountSessionsResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountRevokeOtherSessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountRevokeAllResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    accountRevokeSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountEmptyResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminBindingIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 非空时按状态筛选 */
                status?: "active" | "revoked" | "disabled";
                /** @description 大于0时筛选空间 */
                server_id?: number;
                /** @description 大于0时筛选插件 */
                plugin_id?: number;
                /** @description 关键词，去除首尾空白后模糊搜索 */
                keyword?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminBindingListItem"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminBindingRevoke: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminClientIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 非空时筛选应用类型 */
                type?: "third_party" | "plugin";
                /** @description 非空时按状态筛选 */
                status?: "active" | "suspended";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminClientListItem"][];
                            scope_dict?: string[];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminClientCreate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    note?: string;
                    /** @default [] */
                    redirect_uris?: string[];
                    /** @description 自动补充 user.basic；非数组按空数组处理 */
                    scopes?: ("user.basic" | "user.email" | "idents.read" | "perms.read" | "servers.read")[];
                    /** @description type=plugin 时必填，且对应 active 空间 */
                    server_id?: number;
                    /** @enum {string} */
                    type: "third_party" | "plugin";
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminClientCreated"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminClientSecretReset: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminClientSecret"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminClientStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    status: "active" | "suspended";
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDashboardIndex: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminDashboard"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDocCategories: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminDocCategory"][];
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDocCategoryCreate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    /** @default 0 */
                    sort?: number;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminId"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDocCategoryDelete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDocIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 非空时按状态筛选 */
                status?: "draft" | "published";
                /** @description 大于0时筛选分类 */
                category_id?: number;
                /** @description 关键词，去除首尾空白后模糊搜索 */
                keyword?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminDoc"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDocCreate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 0 表示未分类 */
                    category_id?: number;
                    content_md?: string;
                    /** @description 转为小写；无效、空或重复时自动生成唯一 doc- 前缀标识 */
                    slug?: string;
                    /**
                     * @description 创建时非法值回退 draft
                     * @default draft
                     * @enum {string}
                     */
                    status?: "draft" | "published";
                    title: string;
                    /**
                     * @default public
                     * @enum {string}
                     */
                    visibility?: "public" | "login" | "servers" | "tags";
                    /** @description visibility=servers 时至少一个有效空间 ID */
                    visible_servers?: number[];
                    /** @description visibility=tags 时至少一个有效标签 ID */
                    visible_tags?: number[];
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminId"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDocUpdate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description 0 表示未分类 */
                    category_id?: number;
                    content_md?: string;
                    /** @description 无效或冲突时自动生成唯一标识 */
                    slug?: string;
                    /** @description 空标题忽略 */
                    title?: string;
                    /** @enum {string} */
                    visibility?: "public" | "login" | "servers" | "tags";
                    /** @description servers 可见性至少包含一个有效 ID */
                    visible_servers?: number[];
                    /** @description tags 可见性至少包含一个有效 ID */
                    visible_tags?: number[];
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminVersion"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDocDelete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminDocStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    status: "draft" | "published";
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminFeedbackIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 标题不区分大小写模糊匹配，或精确匹配 UUID/恢复键 */
                keyword?: string;
                /** @description 非空时筛选管理状态 */
                admin_status?: "pending" | "processing" | "resolved";
                /** @description 非空时筛选反馈类型 */
                kind?: "bug" | "feature" | "asset" | "request" | "content" | "campaign" | "suggestion" | "complaint";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminFeedbackListItem"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminFeedbackDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminFeedbackDetail"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminFeedbackStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    admin_note?: string;
                    /** @enum {string} */
                    admin_status: "pending" | "processing" | "resolved";
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminLogIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 动作名前缀匹配 */
                action?: string;
                /** @description 大于0时筛选操作用户 */
                actor_user_id?: number;
                /** @description 大于0时筛选空间 */
                server_id?: number;
                /** @description 非空时精确匹配 client_id */
                client_id?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminAuditLog"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminNotificationIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 关键词，去除首尾空白后模糊搜索 */
                keyword?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminNotificationBatch"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminNotificationCreate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 动作数组或编码该数组的 JSON 字符串；控制器不逐字段校验，按原样存储。 */
                    actions?: ({
                        actionId?: string;
                        emphasis?: string;
                        enabled?: boolean;
                        kind?: string;
                        label?: string;
                        navigationTarget?: {
                            [key: string]: unknown;
                        };
                        unavailableReason?: string | null;
                    } & {
                        [key: string]: unknown;
                    })[] | string;
                    /** @description 内容由管理端约束；body_text 缺省时从 HTML 派生纯文本 */
                    body_html?: string;
                    body_text?: string;
                    /** @enum {string} */
                    category: "announcement" | "personal_update" | "service_notice";
                    /** @description 空字符串为不过期；否则格式 YYYY-MM-DD HH:mm:ss */
                    expires_time?: string;
                    /**
                     * @default optional
                     * @enum {string}
                     */
                    necessity?: "optional" | "necessary";
                    /** @enum {string} */
                    scope: "community" | "personal";
                    summary_text?: string;
                    /** @description scope=personal 时必填且对应用户必须存在 */
                    target_email?: string;
                    title: string;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminNotificationCreated"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminNotificationDelete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 通知批次 UUID */
                batch: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminAffected"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminNotificationExpire: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 通知批次 UUID */
                batch: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminAffected"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginOptions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminPluginBrief"][];
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 非空时按状态筛选 */
                status?: "draft" | "online" | "offline";
                /** @description 关键词，去除首尾空白后模糊搜索 */
                keyword?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminPluginListItem"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginCreate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    description_md?: string;
                    latest_version?: string;
                    name: string;
                    slug: string;
                    summary?: string;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminId"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginUpdate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    description_md?: string;
                    latest_version?: string;
                    name?: string;
                    summary?: string;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginFeatures: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            has_bindings?: boolean;
                            list?: components["schemas"]["AdminPluginFeature"][];
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginFeatureCreate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @default true */
                    default_enabled?: boolean;
                    feature_key: string;
                    name: string;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminId"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginFeatureUpdate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
                /** @description 记录 ID */
                fid: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    default_enabled?: boolean;
                    /** @description 已有绑定码时禁止改变；更新路径没有创建时的格式校验 */
                    feature_key?: string;
                    name?: string;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginFeatureDelete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
                /** @description 记录 ID */
                fid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminPluginStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    status: "draft" | "online" | "offline";
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminServerOptions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminServerBrief"][];
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminServerIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 非空时按状态筛选 */
                status?: "active" | "suspended" | "closed";
                /** @description 关键词，去除首尾空白后模糊搜索 */
                keyword?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminServerListItem"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminServerCreate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    contact_qq?: string;
                    description?: string;
                    name: string;
                    note?: string;
                    /** @description 对应存在且未封禁的用户 */
                    owner_email: string;
                    slug: string;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminId"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminServerDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminServerDetail"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminServerUpdate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    contact_qq?: string;
                    description?: string;
                    logo?: string;
                    name?: string;
                    note?: string;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminServerStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    status: "active" | "suspended" | "closed";
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminSsoIndex: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminSsoRequest"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminSsoRevoke: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 设备请求 device_code */
                deviceCode: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminTagIndex: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminTagListItem"][];
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminTagCreate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    note?: string;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminId"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminTagDelete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminUserIndex: {
        parameters: {
            query?: {
                /** @description 页码，小于1按1处理 */
                page?: number;
                /** @description 每页数量，服务端裁剪到允许范围 */
                page_size?: number;
                /** @description 关键词，去除首尾空白后模糊搜索 */
                keyword?: string;
                /** @description 非空时按整数封禁标记筛选（0正常，1封禁） */
                ban?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: {
                            list?: components["schemas"]["AdminUser"][];
                            total?: number;
                        };
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminUserDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminUserDetail"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminUserBan: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /**
                     * @description 整数转换后等于1为封禁，其他值为解封；省略默认封禁
                     * @default 1
                     */
                    ban?: number;
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminUserPlatformRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /**
                     * @description 省略即清除角色；授予 superadmin 仅超级管理员可操作
                     * @default
                     * @enum {string}
                     */
                    role?: "" | "ops" | "superadmin";
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 当前成功响应为空数组 [] */
                        data: string[];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    adminTagSetUserTags: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /**
                     * @description 全量替换；省略或非数组清空，无效 ID 被忽略
                     * @default []
                     */
                    tag_ids?: number[];
                };
            };
        };
        responses: {
            /** @description 操作成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["AdminTagIds"];
                        /** @description 成功消息 */
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    authCaptchaChallenge: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountCaptchaResponse"];
                };
            };
            403: components["responses"]["BusinessError"];
            /** @description 注解限流异常由现有 ApiHandler 转成 500 */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": components["schemas"]["AccountUnhandledErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    authInvitationCheck: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountEmailRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountEmailRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountInvitationCheckResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            409: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    authInvitationCode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountEmailRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountEmailRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountInvitationCodeResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            409: components["responses"]["BusinessError"];
            /** @description 发送冷却或连续失败锁定 */
            429: {
                headers: {
                    /** @description 剩余等待秒数 */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    authInvitationComplete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountInvitationCompleteRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountInvitationCompleteRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountInvitationCompleteResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            409: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    authInvitationVerify: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountInvitationVerifyRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountInvitationVerifyRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountInvitationVerifyResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            422: components["responses"]["BusinessError"];
            /** @description 发送冷却或连续失败锁定 */
            429: {
                headers: {
                    /** @description 剩余等待秒数 */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    authLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountLoginRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountLoginRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountLoginResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            422: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    authLogout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountEmptyResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    authMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountMeResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    authUpdateProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountProfileRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountProfileRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountMeResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    authUploadAvatar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountAvatarRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["AccountAvatarRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountMeResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            413: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    confirmInternalSsoRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SsoRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["SsoRequest"];
            };
        };
        responses: {
            /** @description 操作成功。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SsoCompletedResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态或客户端凭证无效、访问令牌无效或授权已撤销。 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 身份被禁用、绑定码缺失或无效，或请求频率受限。 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description SSO 请求不存在或已过期。 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 设备请求已完成、已失效、被其他用户处理或应用已停用。 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    inspectInternalSsoRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SsoRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["SsoRequest"];
            };
        };
        responses: {
            /** @description 操作成功。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SsoInspectResponse"];
                };
            };
            /** @description 身份被禁用、绑定码缺失或无效，或请求频率受限。 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description SSO 请求不存在或已过期。 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    loginInternalSsoRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SsoLoginRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["SsoLoginRequest"];
            };
        };
        responses: {
            /** @description 操作成功。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SsoCompletedResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 身份被禁用、绑定码缺失或无效，或请求频率受限。 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description SSO 请求不存在或已过期。 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 设备请求已完成、已失效、被其他用户处理或应用已停用。 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 图片验证码不正确或已过期。 */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    accountAvatarImage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                avatarId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description WebP 图片字节 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/webp": string;
                };
            };
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    contentDocumentList: {
        parameters: {
            query?: {
                /** @description 大于 0 时筛选所属空间 */
                server_id?: number;
                /** @description 大于 0 时筛选分类 */
                category_id?: number;
                /** @description 标题模糊匹配 */
                keyword?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ContentBrowseData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    contentDocumentDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 文档全局唯一 slug */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ContentDocument"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    systemHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["SystemHealthData"];
                        msg: string;
                    };
                };
            };
            /** @description IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 数据库或 Redis 检查异常；现有异常处理器返回 JSON 编码的 {message} 文本，响应沿用 text/html 类型 */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    systemInstallationInstall: {
        parameters: {
            query?: never;
            header: {
                /** @description 固定值 1；初始化页面专用请求头 */
                "X-Setup-Request": "1";
                /** @description 可选；存在时主机和端口必须与 Host 相同 */
                Origin?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SystemInstallInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["SystemInstallData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 初始化请求头缺失或 Origin 主机/端口不匹配；也可能触发 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 已经安装、安装锁竞争，或数据库存在业务表但未选择强制初始化 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
        };
    };
    systemInstallationStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["SystemInstallationStatusData"];
                        msg: string;
                    };
                };
            };
            /** @description IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
        };
    };
    notificationPreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPreferencesResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    notificationUpdatePreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NotificationPreferencesRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPreferencesResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            409: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    notificationList: {
        parameters: {
            query: {
                view: "unread" | "history";
                scope?: "all" | "community" | "personal";
                category?: "announcement" | "personal_update" | "service_notice";
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationListResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    notificationClearAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NotificationClearAllRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["NotificationClearAllRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationClearAllResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    notificationClearPreview: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationClearPreviewResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    notificationReadAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NotificationReadAllRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["NotificationReadAllRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationReadAllResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    notificationSummary: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationSummaryResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    notificationDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                notificationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationDetailResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    notificationSetState: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                notificationId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NotificationStateRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationStateResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            409: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    getInternalOAuthAuthorizationInfo: {
        parameters: {
            query: {
                /** @description 必须对应 active third_party 应用。 */
                client_id: string;
                /** @description 必须精确匹配应用白名单。 */
                redirect_uri: string;
                /** @description 与允许 scope 取交集，自动包含 user.basic。 */
                scope?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 操作成功。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OAuthAuthorizationInfoResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态或客户端凭证无效、访问令牌无效或授权已撤销。 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 身份被禁用、绑定码缺失或无效，或请求频率受限。 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    confirmInternalOAuthAuthorization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OAuthAuthorizationConfirmRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["OAuthAuthorizationConfirmRequest"];
            };
        };
        responses: {
            /** @description 操作成功。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OAuthAuthorizationConfirmResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态或客户端凭证无效、访问令牌无效或授权已撤销。 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 身份被禁用、绑定码缺失或无效，或请求频率受限。 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    verifyInternalOAuthDevice: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OAuthDeviceVerifyRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["OAuthDeviceVerifyRequest"];
            };
        };
        responses: {
            /** @description 操作成功。 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OAuthDeviceVerifyResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态或客户端凭证无效、访问令牌无效或授权已撤销。 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 身份被禁用、绑定码缺失或无效，或请求频率受限。 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 设备请求已完成、已失效、被其他用户处理或应用已停用。 */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverMine: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerMineData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverOverview: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerOverviewData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverSettings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["ServerSettingsInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerSettingsInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverBindingList: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerBindingsData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverBindingCreate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServerPluginIdInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerPluginIdInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerBindingCodeData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverBindingDisable: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 插件绑定码记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverBindingEnable: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 插件绑定码记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverBindingReset: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 插件绑定码记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerBindingCodeData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverClientList: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerClientsData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverClientConnect: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServerClientInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerClientInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverClientDisconnect: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServerClientInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerClientInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverDocCategoryList: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ContentCategoriesData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverDocCategoryCreate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentCategoryInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ContentCategoryInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerCreatedIdData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverDocCategoryDelete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 分类 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverDocList: {
        parameters: {
            query?: {
                /** @description 小于 1 归一为 1 */
                page?: number;
                /** @description 归一为 1..50 */
                page_size?: number;
                /** @description 非空时精确过滤状态 */
                status?: string;
                /** @description 大于 0 时过滤分类 */
                category_id?: number;
                /** @description 标题或 slug 模糊匹配 */
                keyword?: string;
            };
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ContentManagedDocsData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverDocCreate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentServerDocCreateInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ContentServerDocCreateInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerCreatedIdData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverDocUpdate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 文档 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["ContentServerDocUpdateInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ContentServerDocUpdateInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerVersionData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverDocDelete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 文档 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverDocStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 文档 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContentDocStatusInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ContentDocStatusInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverIdentList: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerIdentsData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverIdentBind: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServerIdentBindInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerIdentBindInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerIdentBoundData"] | string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverIdentUnbind: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 绑定记录 ID */
                id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverMemberPermissions: {
        parameters: {
            query: {
                /** @description active 成员用户 ID */
                user_id: number;
            };
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerMemberPermissionsData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverMemberList: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerMembersData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverMemberAdd: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServerMemberAddInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerMemberAddInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverMemberBan: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 目标用户 ID */
                uid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverMemberRemove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 目标用户 ID */
                uid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverMemberRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 目标用户 ID */
                uid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServerMemberRoleInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerMemberRoleInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverMemberUnban: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
                /** @description 目标用户 ID */
                uid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverPermissionMatrix: {
        parameters: {
            query: {
                /** @description 已绑定插件 ID */
                plugin_id: number;
            };
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerPermissionMatrixData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverPermissionSave: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServerPermissionSaveInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverPermissionPush: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["ServerPermissionPushInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerPermissionPushInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["ServerPermissionPushData"];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    serverPermissionReset: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 空间 ID */
                sid: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServerPermissionTargetInput"];
                "application/x-www-form-urlencoded": components["schemas"]["ServerPermissionTargetInput"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: string[];
                        msg: string;
                    };
                };
            };
            400: components["responses"]["BusinessError"];
            /** @description 登录态缺失、无效、过期、撤销或用户不存在 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            /** @description 平台封禁或 IP 错误请求限流 */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessErrorBody"];
                };
            };
            503: components["responses"]["SetupRequired"];
        };
    };
    storageReadFile: {
        parameters: {
            query: {
                key: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 文件字节；统一以 octet-stream 下载 */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    /** @description attachment; filename=文件名 */
                    "Content-Disposition"?: string;
                    "X-Content-Type-Options"?: "nosniff";
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                };
            };
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            503: components["responses"]["BusinessError"];
        };
    };
    storageUpload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["StorageUploadRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageUploadResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            413: components["responses"]["BusinessError"];
            503: components["responses"]["BusinessError"];
        };
    };
    storageComplete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["BusinessError"];
        };
    };
    storagePrepare: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StoragePrepareRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["StoragePrepareRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StoragePrepareResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            413: components["responses"]["BusinessError"];
            503: components["responses"]["BusinessError"];
        };
    };
    feedbackOptions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackOptionsResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    feedbackPrepare: {
        parameters: {
            query?: {
                area?: "development" | "community";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackPrepareRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["FeedbackPrepareRequest"];
            };
        };
        responses: {
            /** @description 同一用户与恢复键已存在，返回原快照 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackSnapshotResponse"];
                };
            };
            /** @description 成功 */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackSnapshotResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            413: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    feedbackLookup: {
        parameters: {
            query: {
                submissionKey: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackSnapshotResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    feedbackDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                submissionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackSnapshotResponse"];
                };
            };
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    feedbackAdvance: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                submissionId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FeedbackAdvanceRequest"];
                "application/x-www-form-urlencoded": components["schemas"]["FeedbackAdvanceRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackSnapshotResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            409: components["responses"]["BusinessError"];
            503: components["responses"]["SetupRequired"];
        };
    };
    feedbackUploadAttachment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                submissionId: string;
                attachmentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["FeedbackAttachmentUploadRequest"];
            };
        };
        responses: {
            /** @description 成功 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedbackSnapshotResponse"];
                };
            };
            400: components["responses"]["BusinessError"];
            401: components["responses"]["BusinessError"];
            403: components["responses"]["BusinessError"];
            404: components["responses"]["BusinessError"];
            409: components["responses"]["BusinessError"];
            413: components["responses"]["BusinessError"];
            503: components["responses"]["BusinessError"];
        };
    };
}
