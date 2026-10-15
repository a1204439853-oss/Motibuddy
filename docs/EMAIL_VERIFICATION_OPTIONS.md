# 注册邮箱验证与密码找回方案

核查日期：2026-10-15。本轮完成方案评估，没有接入线上认证或发送真实邮件。

## 结论与费用

对于个人开发、国内用户为主的 MotiBuddy，优先考虑 **CloudBase 托管认证 + 内置邮件代发**，减少自行维护认证后端和 SMTP 的工作。若优先压低小规模试用的服务账单，并能接受海外服务的连接与投递测试，可选 **Supabase Auth + Resend**。这是按本项目现状作出的选择建议，并非所有环境下的成本保证。

| 方案 | 已核实的费用／限制 | 接入工作及适用范围 |
|---|---|---|
| CloudBase 认证 + 内置邮件 | 支持零配置邮件代发；云开发是开发期免费、正式使用付费，不能承诺长期免费。认证和邮件额度以所选环境当前计费规则为准 | 无须单独搭建认证服务器或配置发信 SMTP，适合希望少维护且国内用户为主的项目 |
| Supabase Auth + Resend SMTP | Supabase Free 含 50,000 月活认证用户；Resend Free 每月 3,000 封、每天最多 100 封。发信域名成本另算；Supabase 免费低活跃项目可能暂停 | 托管密码、验证码和会话，开发较快；需配置自有 SMTP 和域名 DNS，并在目标网络及 QQ／163 等实际邮箱测试 |
| 自建认证 API + 腾讯云 SES | SES 每账号累计 1,000 封免费，超出按 0.0019 元／封；每月 10,000 封不计免费额度约 19 元，仅是邮件费，服务器／函数、数据库、域名另计 | 能控制流程，但验证码、防刷、密码安全和会话均需自己维护；本项目现阶段开发和维护成本较高 |

来源：[CloudBase 邮箱验证码登录](https://docs.cloudbase.net/authentication-v2/method/email-login)、[CloudBase 环境及免费期说明](https://docs.cloudbase.net/quick-start/create-env)、[CloudBase 价格文档](https://cloud.tencent.com/document/product/876/75213)、[Supabase 计费](https://supabase.com/docs/guides/platform/billing-on-supabase)、[Supabase 生产检查](https://supabase.com/docs/guides/deployment/going-into-prod)、[Resend 价格](https://resend.com/pricing)、[腾讯云 SES 价格](https://cloud.tencent.com/document/product/1288/47930)。

Supabase 默认邮件服务当前仅限每小时 2 封，且只允许向团队预授权地址发信，不适合直接给公开用户使用，需另配 SMTP。[官方 SMTP 说明](https://supabase.com/docs/guides/auth/auth-smtp)

Resend 或 SES 只是邮件发送通道，不自动提供安全的账号注册和找回密码功能。CloudBase 的自定义 SMTP 也可使用 QQ 邮箱，但个人邮箱适合小范围调试，不应据此承诺正式产品无限免费发信。[CloudBase 邮箱配置](https://docs.cloudbase.net/authentication-v2/method/email-login)

## 用户操作流程

1. 注册：填写邮箱、用户名和密码 → 发送注册验证码 → 在当前窗口输入验证码 → 服务端验证通过后创建／激活账号 → 登录与领养伙伴。发送成功不等于邮箱已验证。
2. 忘记密码：输入邮箱 → 发送找回专用验证码 → 验证成功取得短时重置凭证 → 设置新密码 → 按认证服务能力撤销旧会话。无需先登录，也不再依赖本地安全问题答案证明邮箱所有权。
3. 邮箱变更：验证新邮箱后才更新认证身份，不允许只修改本地资料中的 email 就改变账号归属。

建议在桌面窗口输入验证码，避免首版还需处理邮件链接唤起应用、自定义 URL 协议及回调地址。CloudBase 支持验证码注册与找回用途；Supabase 邮件模板可以显示 OTP，认证服务负责校验，实际注册与 recovery 类型按 SDK 接入时核实。

来源：[CloudBase 发送验证码](https://docs.cloudbase.net/http-api/auth/auth-send-verification)、[CloudBase 注册](https://docs.cloudbase.net/http-api/auth/auth-sign-up)、[Supabase 邮件模板](https://supabase.com/docs/guides/auth/auth-email-templates)、[Supabase OTP 校验](https://supabase.com/docs/reference/javascript/auth-verifyotp)、[Supabase 重置密码邮件](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)。

## 项目需要怎样改

- 用独立认证服务层替换当前 localStorage 的 `users` 和 `hashed_` 密码比较。验证码由可信服务端生成、验证和消费；禁止在前端生成“正确答案”后自行比较。
- 桌面应用只持有允许公开的客户端配置；SMTP 密码、Resend API Key、SES SecretKey、服务端管理密钥不得放入前端、仓库或打包进 EXE。
- 会话令牌使用 Windows 安全存储，区分在线身份认证与本地业务档案，任务／宠物可继续本地保存。网络不可用时明确区分登录失败和数据丢失。
- 旧账号迁移单独实现：原设备先验证旧账号，再验证邮箱，确认后绑定云 UID 与原本地用户 ID；先备份并处理邮箱冲突，不能仅按同名邮箱自动认领或合并旧进度。
- 密码找回使用目的受限的重置凭证。若自建服务，建议验证码 5—10 分钟有效、同邮箱发送间隔至少 60 秒、限制尝试次数及 IP／设备频率；具体阈值是产品设计建议，须和提供方规则协调。
- 验收真实邮件的正常／过期／重复消费／超限／发送失败、注册中断、邮箱变更、旧账号迁移、离线状态及密码修改后的旧会话。

实际接入需要先确定认证提供方、可用环境和发信配置。当前没有这些线上配置，因此本轮不新增会误导用户的“验证码已发送”按钮，也没有修改现有账号的密码或找回方式。
