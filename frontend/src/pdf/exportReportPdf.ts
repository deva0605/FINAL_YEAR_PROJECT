import { createElement, type ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { WorkflowState } from '../types';
import { buildReportModel, getExportBlocker } from './reportModel';

export class PdfExportError extends Error {}

/**
 * Builds the PDF in the browser from the report currently in memory and downloads it.
 * The PDF library and the fonts are loaded on first use, so they add nothing to the dashboard bundle.
 * Nothing is sent to any server.
 */
export async function exportReportPdf(state: WorkflowState | null | undefined): Promise<string> {
  const blocker = getExportBlocker(state);
  if (blocker) throw new PdfExportError(blocker);

  const [{ pdf }, { ReportDocument }, { registerPdfFonts }] = await Promise.all([import('@react-pdf/renderer'), import('./ReportDocument'), import('./theme')]);

  registerPdfFonts();
  const model = buildReportModel(state as WorkflowState);

  let blob: Blob;
  try {
    blob = await pdf(createElement(ReportDocument, { model }) as ReactElement<DocumentProps>).toBlob();
  } catch (err) {
    console.error('PDF generation failed', err);
    throw new PdfExportError(err instanceof Error && err.message ? `The PDF could not be generated: ${err.message}` : 'The PDF could not be generated.');
  }
  if (!blob || blob.size === 0) throw new PdfExportError('The PDF came out empty, so it was not downloaded.');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = model.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // give the browser a moment to start the download before releasing the blob
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return model.fileName;
}
