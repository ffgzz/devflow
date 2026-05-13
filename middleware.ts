export { auth as middleware } from "@/auth";

/*
Next.js 的 Middleware 是一种运行在请求进入服务器之前的拦截器。

核心作用：

在请求到达页面/API之前执行代码
可以修改请求（rewrite）、重定向（redirect）、设置 cookies、添加 headers 等
常用于：认证校验、IP限制、请求日志、A/B测试灰度发布等
*/
