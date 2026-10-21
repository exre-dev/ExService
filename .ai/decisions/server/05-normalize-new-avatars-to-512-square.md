# 新上传头像统一为 512×512 WebP

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：旧 Node 头像实现已退役；PHP 头像行为以当前 Controller 为准
- 模块：`server`
- 日期：2026-09-24
- 来源：用户设置面板设计 `.notes/archive/backend-sandbox/user-settings/specs/2026-09-24-user-settings-panel-design.md` 与技术 RFC `.notes/archive/backend-sandbox/user-settings/rfcs/user-settings-panel-rfc.md`

_最后更新：2026-10-08_

## 背景

当前 `ProfileService` 使用 Sharp 将头像等比缩到最大 512×512，且不放大小图。因此存储结果可以不是正方形，也可能小于 512 像素。设置面板将提供用户可操作的正方形裁剪，但直接调用既有上传 operation 的请求不会经过这个浏览器界面。

## 决策

- 对**新的头像上传**，Server 在已有输入格式、字节数、像素数、边长和单页检查之后，按 EXIF 方向旋转、居中裁剪并按需缩放，最终保存为固定 512×512 WebP。继续保持现有输出字节上限、会话写入检查和文件引用清理。
- 浏览器使用 `react-easy-crop` 提供 1:1 裁剪和取景预览，提交的图片也规范到 512×512；服务端仍负责最终尺寸，不能信任浏览器裁剪已执行。
- 不新增 HTTP operation、请求或响应字段，不批量改写历史头像。已有非标准尺寸文件继续按现有头像读取 operation 提供。

## 理由与取舍

浏览器裁剪让用户决定取景范围，服务端规范化保证绕过 UI 的调用也得到统一像素。只做浏览器裁剪无法约束 API 调用；只做服务端居中裁剪无法让用户控制取景。较小原图需要放大，可能模糊，应由裁剪预览呈现效果。

## 适用范围与重新审视

Server 已对新上传头像执行该规则；本决策不声称该像素规则已被 HTTP Contract 的 schema 校验。若需要统一历史头像、改变尺寸或将像素约束写入跨实现 Contract，应单独评审迁移与兼容性。
