# Fonts used for the PDF export

`Inter_*.ttf` are static instances of the Inter typeface (Rasmus Andersson), distributed through the
`@expo-google-fonts/inter` npm package and licensed under the SIL Open Font License 1.1
(https://openfontlicense.org). They are embedded in exported PDFs because the standard PDF fonts cannot draw the
Indian rupee sign (U+20B9); these files include it, and the arrows, dashes and comparison symbols the report uses.
