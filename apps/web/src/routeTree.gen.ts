/* eslint-disable */

// @ts-nocheck

import { Route as rootRouteImport } from "./routes/__root";
import { Route as IndexRouteImport } from "./routes/index";
import { Route as LoginRouteImport } from "./routes/login";
import { Route as AdminRouteImport } from "./routes/admin";
import { Route as WhatsappRouteImport } from "./routes/whatsapp";
import { Route as DisplayRouteImport } from "./routes/display";
import { Route as PatientRouteImport } from "./routes/patient";

const IndexRoute = IndexRouteImport.update({
  id: "/",
  path: "/",
  getParentRoute: () => rootRouteImport,
} as any);
const LoginRoute = LoginRouteImport.update({
  id: "/login",
  path: "/login",
  getParentRoute: () => rootRouteImport,
} as any);
const AdminRoute = AdminRouteImport.update({
  id: "/admin",
  path: "/admin",
  getParentRoute: () => rootRouteImport,
} as any);
const WhatsappRoute = WhatsappRouteImport.update({
  id: "/whatsapp",
  path: "/whatsapp",
  getParentRoute: () => rootRouteImport,
} as any);
const DisplayRoute = DisplayRouteImport.update({
  id: "/display",
  path: "/display",
  getParentRoute: () => rootRouteImport,
} as any);
const PatientRoute = PatientRouteImport.update({
  id: "/patient",
  path: "/patient",
  getParentRoute: () => rootRouteImport,
} as any);

export interface FileRoutesByFullPath {
  "/": typeof IndexRoute;
  "/login": typeof LoginRoute;
  "/admin": typeof AdminRoute;
  "/whatsapp": typeof WhatsappRoute;
  "/display": typeof DisplayRoute;
  "/patient": typeof PatientRoute;
}
export interface FileRoutesByTo {
  "/": typeof IndexRoute;
  "/login": typeof LoginRoute;
  "/admin": typeof AdminRoute;
  "/whatsapp": typeof WhatsappRoute;
  "/display": typeof DisplayRoute;
  "/patient": typeof PatientRoute;
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport;
  "/": typeof IndexRoute;
  "/login": typeof LoginRoute;
  "/admin": typeof AdminRoute;
  "/whatsapp": typeof WhatsappRoute;
  "/display": typeof DisplayRoute;
  "/patient": typeof PatientRoute;
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath;
  fullPaths: "/" | "/login" | "/admin" | "/whatsapp" | "/display" | "/patient";
  fileRoutesByTo: FileRoutesByTo;
  to: "/" | "/login" | "/admin" | "/whatsapp" | "/display" | "/patient";
  id: "__root__" | "/" | "/login" | "/admin" | "/whatsapp" | "/display" | "/patient";
  fileRoutesById: FileRoutesById;
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute;
  LoginRoute: typeof LoginRoute;
  AdminRoute: typeof AdminRoute;
  WhatsappRoute: typeof WhatsappRoute;
  DisplayRoute: typeof DisplayRoute;
  PatientRoute: typeof PatientRoute;
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute,
  LoginRoute,
  AdminRoute,
  WhatsappRoute,
  DisplayRoute,
  PatientRoute,
};

export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>();
