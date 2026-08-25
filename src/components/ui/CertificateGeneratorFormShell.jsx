import Sidebar from "@/components/layout/Sidebar";

export default function CertificateGeneratorFormShell({ inAppLayout, children }) {
  if (inAppLayout) {
    return (
      <div className="certificate-generator-form-panel">{children}</div>
    );
  }

  return (
    <Sidebar
      isOpen
      className="!static !top-0 !h-full rounded-l-lg !space-y-0"
    >
      {children}
    </Sidebar>
  );
}
