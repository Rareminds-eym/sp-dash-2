'use client';
import { useEffect, useState } from 'react';
import { jobDescriptionBlocks } from '@/lib/zoho/job-description';
import styles from './ZohoRecruitPage.module.css';

export default function JobDescription({ value }) {
  const [content,setContent] = useState(null);
  // Parse rich source text only in the browser, keeping SSR/hydration consistent.
  useEffect(() => setContent({value,blocks:jobDescriptionBlocks(value)}), [value]);
  if (!content || content.value !== value) return <p role="status">Loading description…</p>;
  return <div className={styles.jobDescriptionBody}>
    {content.blocks.length ? content.blocks.map((block,index) => block.type === 'heading'
      ? <h5 key={index}>{block.text}</h5>
      : block.type === 'list'
        ? <ul key={index}>{block.items.map((item,i) => <li key={i}>{item}</li>)}</ul>
        : <p key={index}>{block.text}</p>)
      : <p>No description provided.</p>}
  </div>;
}
