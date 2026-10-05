import { ExternalLink, Figma, FileText, Github, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const resources = [
  { icon: Github, title: 'GitHub Repository', text: 'View source code and implementation history', action: 'Go to Repository', url: import.meta.env.VITE_GITHUB_URL || 'https://github.com/' },
  { icon: Figma, title: 'Figma Design', text: 'View user interface wireframes and style guides', action: 'Go to Design', url: import.meta.env.VITE_FIGMA_URL || 'https://www.figma.com/' },
  { icon: Send, title: 'Postman Collection', text: 'View API endpoints documentation and API testing', action: 'Go to API Docs', url: import.meta.env.VITE_POSTMAN_URL || 'https://www.postman.com/' },
  { icon: FileText, title: 'Project Report', text: 'View comprehensive thesis, research and metrics report', action: 'Download Report', url: import.meta.env.VITE_REPORT_URL || '#' }
];

export default function ProfilePage() {
  const { auth } = useAuth();
  return (
    <>
      <section className="profile-card">
        <img
          className="profile-avatar"
          src="/avt.jpg"
          alt="Profile avatar"
        />
        <div className="profile-info">
          <h2>Phạm Xuân Minh</h2>
          <div>
            <span>{auth?.username || 'admin'}</span>
            <span className="profile-divider" />
            <span>Mã sinh viên: B23DCCN564</span>
            <span className="profile-divider" />
            <span>Lớp: D23CNPM02</span>
            <span className="profile-divider" />
            <span>Project: IoT Monitoring System</span>
          </div>
        </div>
        <span className="role-tag">STUDENT DEVELOPER</span>
      </section>

      <h3 className="resources-title">PROJECT RESOURCES</h3>
      <div className="resource-grid">
        {resources.map(({ icon: Icon, title, text, action, url }) => (
          <article className="resource-card" key={title}>
            <Icon size={24} strokeWidth={1.8} />
            <h3>{title}</h3>
            <p>{text}</p>
            <a href={url} target={url === '#' ? undefined : '_blank'} rel="noreferrer">{action} <ExternalLink size={14} /></a>
          </article>
        ))}
      </div>
    </>
  );
}
