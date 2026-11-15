import PDFDocument from 'pdfkit';
import type { DevisDetail } from '../repositories/devis.repository.js';

/** Produit le PDF en memoire, sans stockage permanent. */
export class DevisPdfService {
  generer(d: DevisDetail): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: { Title: `Devis ${d.id_devis}`, Author: 'Innov’Events' },
      });
      const morceaux: Buffer[] = [];
      document.on('data', (part: Buffer) => morceaux.push(part));
      document.on('end', () => resolve(Buffer.concat(morceaux)));
      document.on('error', reject);
      document.fontSize(20).text('Innov’Events — Devis', { align: 'center' }).moveDown();
      document
        .fontSize(12)
        .text(`Devis n° ${d.id_devis}`)
        .text(`Intitulé : ${d.intitule}`)
        .text(`Client : ${d.nom_contact ?? ''}`)
        .moveDown();
      for (const ligne of d.lignes) {
        document
          .fontSize(10)
          .text(`${ligne.libelle_prestation} : ${Number(ligne.montant_ht).toFixed(2)} € HT`);
        if (document.y > 710) document.addPage();
      }
      const ht = d.lignes.reduce((s, l) => s + Math.round(Number(l.montant_ht) * 100), 0);
      const tva = Math.round((ht * Number(d.taux_tva_applique)) / 100);
      document
        .moveDown()
        .fontSize(12)
        .text(`Total HT : ${(ht / 100).toFixed(2)} €`)
        .text(`TVA (${d.taux_tva_applique} %) : ${(tva / 100).toFixed(2)} €`)
        .text(`Total TTC : ${((ht + tva) / 100).toFixed(2)} €`);
      document.end();
    });
  }
}
